##browserdude
Utilize stk500v1 https://github.com/Pinoccio/js-stk500 and soon stk500v2 https://github.com/Pinoccio/js-stk500 to upload to arduinos from Chrome

Not sure how to implement long term. Ideally we'd just run in the browser and anyone could use us. However Chrome permissions mean we need to whitelist every domain that would call in on an external url so thats not possible. So for now this is a reference app to show how stk500 works in a browser.

##Gotchas
* Currently using my fork of browser-serialport as it doesnt currently support setting control signals, and there were a few bugs.

##INSTALL
Go to chrome://extensions/ and check developer mode in the upper right corner. Then load unpacked extension and choose this directory.

##Program:
By default uploads blink to the first Uno it can find. In chrome://extensions/ click Background page and type stk500.upload(); Make changes in stk500.js

##Make Changes:
If you make any changes to stk500.js you'll need to rebuild. Assuming you have node already instealled, download and install dependancies with:
```
npm install -g browserify
npm install
```
Then
```
browserify stk500.js -o bundle.js
```
And now you can Reload in chrome://extensions/

###CHANGELOG
0.0.1 
first
