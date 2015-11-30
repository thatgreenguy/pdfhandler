
var getmailoptions = require( '/src/common/getmailconfig.js' ),
  log = require( '/src/common/logger.js' ),
  parg = {};


parg.newPdf = 'R5X42565_ESXCOC01_123456';
//parg.newPdf = 'R55DV0A_EHQDVPY_123456';


getmailoptions.getMailOptions( parg, function( err, res ) {

  if ( err ) {

    log.e( 'OOPS: ' + err );

  } else {

    log.i( 'OK : ' + res);
    log.i( 'pargs : ' + JSON.stringify( parg ) );

  }
}); 


