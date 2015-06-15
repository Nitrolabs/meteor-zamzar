Package.describe({
  name: 'maxkferg:zamzar',
  version: '0.1.7',
  summary: 'Convert files using the Zamzar API',
  git: 'https://github.com/NitroLabs/meteor-zamzar.git',
  documentation: 'README.md'
});

Npm.depends({
  'temp':'0.8.1',
  'request':'2.57.0',
  'valid-url':'1.0.9',
  'streamifier':'0.1.1'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.export('Zamzar');
  api.addFiles('zamzar-client.js','client');
  api.addFiles('zamzar-server.js','server');
});

Package.onTest(function(api) {
  var assets = [
    "assets/demo.docx",
    "assets/form.xlsx",
    "assets/tree.jpg",
  ]
  api.use('tinytest');
  api.use('maxkferg:zamzar');
  api.use('keyvan:asset-readable-stream@0.0.1');
  api.addFiles('zamzar-tests.js');
  api.addFiles(assets,'server',{isAsset:true});
});
