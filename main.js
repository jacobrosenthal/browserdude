var btn =  document.getElementById('test-button');
var statusElement =  document.getElementById('status');

btn.addEventListener('click', function () {
  statusElement.innerHTML="looking...";

  stk500.findFirstPort(function(error, path){

  	if(error){
  		statusElement.innerHTML=error.message;
  		throw error;
		}

		statusElement.innerHTML="programming..." + path;

	  stk500.upload(path, function(error){
	  	if(error){
	  		statusElement.innerHTML=error.message;
	  		throw error;
	  	}
	  	statusElement.innerHTML="programming Success";
	  });

  });

});