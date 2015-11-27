

var log = require( './common/logger.js' ),
  veropt = [],
  mailopt =[];



mailopt = [['EMAIL', 'N'], ['EMAIL_TO', 'aaa@bbb.com'], ['EMAIL_TO', 'bbb@bbb.com'], ['SUBJECT', 'Test Report Lvl Subject']];
veropt = [['EMAIL', 'Y'], ['EMAIL_TO', 'ccc@bbb.com'] ];



log.d( 'Report Level: ' + mailopt );
log.d( 'Version Level: ' + veropt );


for ( var prop in veropt ) {

  if ( veropt.hasOwnProperty( prop )) {

    log.w( 'Option: ' + prop + ' value: ' + veropt[ prop ]);



  }
}






