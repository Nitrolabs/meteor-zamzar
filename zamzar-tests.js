var _ = Npm.require("underscore");
var fs = Npm.require('fs');
var path = Npm.require('path');
var request = Npm.require('request');
var streamifier = Npm.require('streamifier');
 
var file1 = 'assets/form.xlsx';
var file2 = 'assets/demo.docx';
var file3 = 'assets/tree.jpg';
var outfile1 = path.join(getUserHome(), 'desktop', 'zamzar-test1.pdf'); 
var outfile2 = path.join(getUserHome(), 'desktop', 'zamzar-test2.pdf'); 

// The api key must be provided in Meteor.settings
// This is not strictly required for general use, but tests will fail without it
var apikey = Meteor.settings.zamzar.apikey;
Zamzar.config({apikey:APIKEY, verbose:true});


function getUserHome() {
  return process.env.HOME || process.env.USERPROFILE;
}

// Test the creation of job objects
Tinytest.add('test-job', function (test) {
	var format = "pdf";
  var file = fs.createReadStream(file3);
	var job = new Zamzar.Job(file,format);
	test.equal(_.isFunction(job.convert), true);	
	test.equal(_.isFunction(job.download), true);
});


// Test the conversion of document1
Tinytest.add('test-convert-file1', function (test) {
  var format = "pdf";
  var file =  AssetReadableStream(Assets).get(file1);
  var job = new Zamzar.Job(file,format);
  var result = job.convert();
  test.equal(result.status, "successful");
  test.equal(_.isString(result.downloadUrl),true);
});


// Test the conversion of document2
Tinytest.add('test-convert-file2', function (test) {
  var format = "pdf";
  var file = AssetReadableStream(Assets).get(file3);
  var job = new Zamzar.Job(file,format);
  var result = job.convert();
  test.equal(result.status, "successful");
  test.equal(_.isString(result.downloadUrl),true);
});

// Test the conversion of document3
Tinytest.add('test-convert-file3', function (test) {
  var format = "pdf";
  var file = AssetReadableStream(Assets).get(file2);
  var job = new Zamzar.Job(file,format);
  var result = job.convert();
  test.isTrue(result.status,"Failed: Metadata needs a status");
  test.isTrue(_.isString(result.downloadUrl),"Failed: Metadata needs a downloadUrl");
});

// Test the download of document1
Tinytest.add('test-download', function (test) {
  var format = "pdf";
  var file = AssetReadableStream(Assets).get(file3);
  var job = new Zamzar.Job(file,format);
  var result = job.convert();
  var stream = job.download();
  stream.pipe(fs.createWriteStream(outfile1));
});

// Test the manual download
Tinytest.add('test-manual-download', function (test) {
  var format = "pdf";
  var file = AssetReadableStream(Assets).get(file2);
  var job = new Zamzar.Job(file,format);
  var result = job.convert();

  test.equal(result.status, "successful");
  test.isTrue(result.downloadUrl);
  test.isTrue(_.isString(result.downloadUrl));
  console.log(result.downloadUrl)

  var stream = request(result.downloadUrl)
  stream.pipe(fs.createWriteStream(outfile2));
});




