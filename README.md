# Zamzar
File conversion for Meteor using the Zamzar API. Convert files between 1100+ file formats using Zamzar. Currently, files can only be converted from the server. Pull requests are welcome for client side support.

## Setup
Sign up for a developer account over at [Zamzar developers](https://developers.zamzar.com "Zamzar developers website"). Find your API key and copy it for later. Then add Zamzar to your Meteor project
```sh
meteor add maxkferg:zamzar
```

## Usage
### Zamzar.configure(options)
Set the global options for Zamzar. Only the API key is required. The other options will take the default values. Inputs:
* apikey - You apikey from the [Zamzar developers website](https://developers.zamzar.com)
* pollrate - Poll rate while files are being converted (Milliseconds)
* timeout - Maximum time to wait for the conversion (Milliseconds)

```js
var options = {
    apikey:"",
    pollrate:500, //ms
    timeout:60*1000, //ms
}
// Set the global options
Zamzar.configure(options)
```

### Zamzar.Job(file,target_format,[source_mimetype])
The Zamzar API is exposed through job objects. A job is created to describe the type of conversion that will be processed.<br>
* file - The file to be converted. Either a url, local path, or readstream
* target_format - The format of the converted file. See the allowable
* source_mimetype - Used to overide the mimetype that Zamzar assumes from the filename
[formats](https://developers.zamzar.com/formats)

```js
var file = "http://www.site.com/path/to/some/file";
var file = "/user/maxkferg/desktop/myfile.docx";
var file = fs.createReadStream(somepath);
var target_format = "pdf"; // or ["docx","wps"...]
// Create a job object to manage the conversion
var job = new Zamzar.Job(file,target_format);
```

### job.convert()
Upload and convert a file using the Zamzar API. 
<br>Return a metadata object containing the url of the converted file. 
<br>Throw a new Meteor.error() if the conversion fails.
```
var file = fs.createReadStream(somepath);
var target_format = "pdf"; // or ["docx","wps"...]
// Set the global options
var job = new Zamzar.Job(file,target_format);
var metadata = job.convert()
var url = metadata.downloadUrl
```

### job.download()
Utility function for downloading files. This functionality is separated from the convert method, as it may be preferred to download the file at a later time.
<br>Return a readStream for the converted file data 
<br>Throw a new Meteor.error() if the download fails
* metadata - The metadata object as returned by Zamzar.convert

```js
var file = "http://www.site.com/path/to/some/file";
var target_format = "pdf"; // or ["docx","wps"...]
// Convert and download the file
var job = new Zamzar.Job(file,target_format);
var metadata = job.convert();
var stream = job.download();
```

## Event Hooks
For some conversions jobs the status may be important. Zamzar provides event hooks to provide callbacks for various events.

```js
var file = "http://www.site.com/path/to/some/file";
var target_format = "pdf"; // or ["docx","wps"...]

var job = Zamzar.convert(file,target_format);
job.on("upload",function(metadata){
    // The file has been uploaded
});
job.on("convert",function(){
    // The file has been converted
});
job.on("status",function(){
    // Called everytime the Zamzar API is polled
});

// Convert and download the file
job.convert();
job.download();
```

## Metadata
Conversion state is held in the metadata object. The metadata object is in the following form.
```js
metadata = {



}


## License
MIT

