var jazzicon = require('jazzicon');


(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var icons = document.querySelectorAll('.user-icon');
    Array.prototype.forEach.call(icons, function(el, i){
      var num = parseInt( el.getAttribute('data-icon'), 10);
      var icon = jazzicon(48, num);
      el.appendChild(icon);
    });
  }); 
})();
