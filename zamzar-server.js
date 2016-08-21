var fs = Npm.require('fs');
var _ = Npm.require('underscore');
var mime = Npm.require('mime');
var retry = Npm.require('retry');
var request = Npm.require('request');
var validUrl = Npm.require('valid-url');
var Future = Npm.require('fibers/future');


Zamzar = {}


Zamzar.config = function(options){
	// Set the service options
	// Available options are:
	// apikey (required): The Zamzar API Key
	// pollrate (optional): The rate which we poll the Zamzar server in ms
	// timeout (optional): The maximum amount of time to wait for a http request
	// verbose (optional): Write status messages to the console
	defaults = {
		pollrate: 1500, // Milliseconds
		timeout: 60*1000, // Milliseconds
		verbose: false // Write status messages to the console
	};
	if (!options.apikey){
		throw new Error("An API key must be provided to use Zamzar");
	}
	this.options = _.extend(defaults,options);
}




Zamzar.Job = function(file,target_format,mimetype){
	// Job object. Controls the conversion flow.
	// @file - The file to be converted. Either a url, filepath or readStream
	// @target_format - the target conversion format. See the Zamzar documentation
	// @mimetype (optional) - the source file mimetype. Can be provided to overide the assumed mimetype
	this.file = file;
	this.target_format = target_format;
	this.mimetype = mimetype;


	this.convert = function(){
		// Convert a this.file to target_format
		var stream = this._createReadStream(this.file);
		this.metadata = this._startConversion(stream, this.target_format);
		this.metadata = this._waitForConversion(this.metadata);
		this.metadata.downloadUrl = this._getDownloadUrl(this.metadata);
		return this.metadata;
	};


	this.download = function(){
		// Return the downloaded file as a readStream
		// Throw a future.Error on failure
		if (!this.metadata){
			return Meteor.throw("Call job.convert before job.download")
		} else {
			var future = new Future();
		    var url = this._getDownloadUrl(this.metadata);
		    if (Zamzar.options.verbose) console.log("Downloading file");

				var future = new Future();

				// Note: NPM's request library is incompatible with our API when its followRedirect flag is turned
				// on. Instead, this sample code performs a manual redirect if necessary.

				var stream = request.get({url: url, followRedirect: false}, function (err, response, body) {
				    if (err) {
				        console.log(err)
				    } else {
				        // We are being redirected
				        if (response.headers.location) {
				            // Issue a second request to download the file
				            var redirectedStream = request(response.headers.location);
				          	future.return(redirectedStream);
				        }
				    }
				}).auth(apiKey,'',true);

				future.return(stream);

				return future.wait();
		}
	};


	this._createReadStream = function(file){
		// Create a readstream from the file input
		// File input could be a url, filepath, or readStream
		var verbose = Zamzar.options.verbose;
		if (_.isString(file)){
			var uri = validUrl.is_web_uri(file);
			if (!uri){
				if (verbose) console.log("Reading file from path");
				return fs.createReadStream(file);
			} else {
				if (verbose) console.log("Reading file from " + uri);
				return request({
					method: 'GET',
    				uri: uri,
    				gzip: true
    			}, function (error, response, body) {
					var size = Math.round((response.headers['content-length'] || 0) / 1000);
  					if (verbose) console.log('Downloaded ' + size + ' kb of compressed data');
				});
			}
		} else if (_.isFunction(file.pipe)){
			if (verbose) console.log("Reading file from stream");
			return file;
		} else {
			if (verbose) console.log('Unknown file object');
			return file;
			throw new Meteor.Error('Unknown file object');
		}
	};


	this._startConversion = function(read_stream,target_format){
		// Start conversion job
		// Use Futures to block until the response is ready
		var formData;
		var future = new Future();
		var verbose = Zamzar.options.verbose;

	    form = {
	        target_format: target_format,
	        source_file: read_stream
	    };

	    if (this.mimetype){
	    	var format = mime.extension(this.mimetype);
	    	if (format){
	    		form.source_format = format
	    	} else {
	    		console.info("Unable to guess extension from "+this.mimetype);
	    		console.info("Sending multipart form without source_format");
	    	}
	    }

	    request.post({url:'https://api.zamzar.com/v1/jobs/', formData:form}, function (err, response, body) {
	        if (err) {
		        console.error('Unable to start conversion job:\n    ' + err);
		        future.throw('Unable to start conversion job');
		    } else if (!body) {
		    	console.error('Unable to start conversion job');
		    	if (verbose) console.log(JSON.stringify(response));
		        future.throw('Response had no body');
		    } else {
		    	console.log('Conversion job started');
		    	var data = JSON.parse(body);
		    	if (data.errors){
		        	future.throw('The Zamzar API returned an error: ' + JSON.stringify(data.errors));
		    	} else {
		        	future.return(data);
		        }
		    }
		}).auth(Zamzar.options.apikey, '', true);

		return future.wait();
	}


	this._waitForConversion = function(metadata){
		// Block until the file is ready for download
		// Throw an error if the conversion is cancelled
		// Throw an error if the conversion is not complete after timeout
		var future = new Future();
		var jobId = metadata.id;
		var operation = retry.operation({
			retries: 20,//Math.round(this.timeout / this.pollrate),
			factor: 2,
			minTimeout: 500,//this.pollrate/2,
			maxTimeout: 2000,//this.pollrate*2,
			randomize: true,
		});


		console.log('Waiting')
		operation.attempt(function(currentAttempt) {
			request.get('https://api.zamzar.com/v1/jobs/' + jobId, function (err, response, body) {
				if (err) {
			    	console.error('Unable to get job status:',err);
			    	future.throw('Unable to get job status:',err);
			    } else {
			    	var data = JSON.parse(body);
			        if (data.status==="successful"){
			        	if (Zamzar.options.verbose){
			        		console.log("Conversion Success");
			        	}
			        	future.return(data);
			        } else if (data.errors){
			        	console.log("Conversion Error");
			        	future.throw(data.errors[0]);
			        } else if (operation.retry("Conversion took to long")) {
			       		if (Zamzar.options.verbose) console.info("Status: Not ready yet");
			        } else {
			        	console.error("Convert operation timeout");
			        	future.throw(operation.mainError());
			        }
			    }
			}).auth(Zamzar.options.apikey, '', true);
		});

		return future.wait();
	}

	this._getDownloadUrl = function(metadata){
		// Return the canonical download url for the file object
		// Proper authorization is required to access this url
		var fileID = metadata.target_files[0].id;
	    return 'https://api.zamzar.com/v1/files/' + fileID + '/content';
	}
}
