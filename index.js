var SerialPort = require("serialport");
var intel_hex = require('intel-hex');
var Stk500 = require('stk500');
var fs = require('fs');

var usbttyRE = /(cu\.usb|ttyACM|COM\d+)/;

var data = fs.readFileSync( 'node_modules/stk500/arduino-1.0.6/uno/Blink.cpp.hex' , { encoding: 'utf8' });

var hex = intel_hex.parse(data).data;

var uno = {
  baud: 115200,
  signature: new Buffer([0x1e, 0x95, 0x0f]),
  pageSize: 128,
  timeout: 400
};

// //create a window incase we are running this from node
if(typeof window === 'undefined') window = this;

(function() {

function findFirstPort(done){

	SerialPort.list(function (error, ports) {
		if(error) throw error;

		var notFound = ports.every(function(port){

			if (usbttyRE.test(port.comName)){

				done(null, port.comName);
				return false;
			} 
			return true	;
		});

		if(notFound) done(new Error("couldn't find an Arduino to program"));

	});

}

function upload(path, done){

	var serialPort = new SerialPort.SerialPort(path, {
	  baudrate: uno.baud,
	});

	serialPort.on('open', function(){

	  Stk500.bootload(serialPort, hex, uno, function(error){

	    serialPort.close(function (error) {
	      console.log(error);
	    });

	    if(error){
	      console.log("programing FAILED: " + error);
	      done(new Error("programing FAILED: " + error));
	    }else{
	      console.log("programing SUCCESS!");
	      done();
	    }

	  });

	});

}

window.stk500 = {
  upload:upload,
  findFirstPort:findFirstPort
};

})(window);

//if we are in node, upload to the supplied port
if(process && process.argv && process.argv[2])
{
	this.stk500.upload(process.argv[2], function(error){
		console.log(error);
	});
}