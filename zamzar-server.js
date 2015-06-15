var fs = Npm.require('fs');
var _ = Npm.require('underscore');
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




Zamzar.Job = function(file,target_format){
	// Job object. Controls the conversion flow.
	// @file - The file to be converted. Either a url, filepath or readStream
	// @target_format - the target conversion format. See the Zamzar documentation
	this.file = file;
	this.target_format = target_format;


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
			var fileID = this.metadata.target_files[0].id;
		    var future = new Future();
		    var url = this._getDownloadUrl(this.metadata);
		    console.log(url)
		    if (Zamzar.options.verbose) console.log("Downloading file");
		    var stream = request(url).auth(Zamzar.options.apikey, '', true);
		    // Check the request for errors
		    stream.on('error', function(err) {
    			console.log(err)
  			});
  			return stream;
		}
	};


	this._createReadStream = function(file){
		// Create a readstream from the file input
		// File input could be a url, filepath, or readStream
		var verbose = Zamzar.options.verbose;
		if (_.isString(file)){
			var uri = validUrl.is_web_uri(value);
			if (uri){
				if (verbose) console.log("Reading uri");
				return request(uri);
			} else {
				if (verbose) console.log("Reading file from path");
				return fs.createReadStream(file);
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
		
	    form = {
	        target_format: target_format,
	        source_file: read_stream
	    };
	    
	    request.post('https://api.zamzar.com/v1/jobs/', {formData:form}, function (err, response, body) {
	        if (err) {
		        console.error('Unable to start conversion job', err);
		        future.throw('Unable to start conversion job', err);
		    } else if (!body) {
		    	console.error('Unable to start conversion job');
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

		return future.waitFor(Zamzar.options.timeout);
	}


	this._waitForConversion = function(metadata){
		// Block until the file is ready for download
		// Throw an error if the conversion is cancelled
		// Throw an error if the conversion is not complete after timeout
		var future = new Future();
		var jobId = metadata.id;
		var comp;

		console.log('Waiting')
		comp = Meteor.setInterval(function(){
			request.get('https://api.zamzar.com/v1/jobs/' + jobId, function (err, response, body) {
			    if (err) {
			        console.error('Unable to get job', err);
			        future.throw('Unable to get job', err);
			    } else {
			    	var data = JSON.parse(body);
			        if (data.status==="successful" && !future.isResolved()){
			        	if (Zamzar.options.verbose){
			        		console.log("Conversion Success");
			        		console.log('Status:',data);
			        	}
			        	future.return(data);
			        	clearInterval(comp);		
			        } else if (data.errors){
			        	clearInterval(comp);
			        	console.log("Conversion Error");
			        	future.throw(data.errors[0]);
			        } else if (Zamzar.options.verbose) {
			        	console.log("Not ready yet");
			        	console.log('Status:',data);
			        }
			    }
			}).auth(Zamzar.options.apikey, '', true);
		}, Zamzar.options.pollrate);
		
		return future.waitFor(Zamzar.options.timeout);
	}


	this._getDownloadUrl = function(metadata){
		// Return the signed url to the file object
		// While the metadata object contains a file url, that url is just canonical
		// Uses Futures to block until ready
		var fileID = metadata.target_files[0].id;
	    var future = new Future();
	    var url = 'https://api.zamzar.com/v1/files/' + fileID + '/content';
		request.get(url, {followRedirect:false}, function (err, response, body) {
		    if (err) {
		        console.error('Unable to download file:', err);
		        future.error('Unable to download file:', err);
		    } else if (!response.headers.location) { 
		    	console.error("Zamzar would not give us a url to the file")
				future.error("Zamzar would not give us a url to the file");
		  	} else if (Zamzar.options.verbose){
		        console.log('Got the secert url: ',response.headers.location);
		        future.return(response.headers.location);
		    } else {
		  		future.return(response.headers.location);
		    }
		}).auth(Zamzar.options.apikey, '', true);
	    return future.waitFor(Zamzar.options.timeout);
	}
}


console.info('Patching Future')
Future.prototype.waitFor = function(delay){
	// Wait for @delay, and then throw a timeout error
	// Disables return and throw handlers after timout.
	var self = this;
	Meteor.setTimeout(function(){
		if (!self.isResolved()){
			var message = "Future timeout after "+delay/1000+"s"
			self.throw(new Meteor.Error(500,message));
			self.throw = function(){ console.error("Late Future throw")};
			self.return = function(){ console.info("Late Future return")};
		}
	},delay);
	return self.wait();
}
