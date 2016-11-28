var async = require( 'async' ),
  moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  audit = require( './common/audit.js' ),
  getnewpdf = require( './getnewpdf.js' ),
  dologo = require( './common/dologo.js' ),
  domail = require( './common/domail.js' ),
  processInfo = process.env.PROCESS_INFO,
  processStatusFrom = process.env.PROCESS_STATUS_FROM,
  processStatusTo = process.env.PROCESS_STATUS_TO,
  pollInterval = process.env.POLLINTERVAL,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;



// Synopsis
//
// Poll the JDE PDF Process Queue 24/7 for new entries at the correct status for Logo or Mail processing.
// Pick up any new PDF entires added process them by applying Logo or performing Email then move them to next (to) status
// Log results of processing in F559859 Audit Log


initialisation() 
async.forever( check, error );


// Function List
// -------------
//
// function check( cbDone ) 
// function error( cbDone ) 


function check( cbDone ) {

  var parg = {},
    checkStart,
    checkEnd;

  checkStart = moment();
  log.d( ' Perform Check ( every ' + pollInterval + ' milliseconds )' );

  async.series([
    function( next ) { checkGetNewPdf( parg, next )  }
  ], function( err, res ) {

    checkEnd = moment();
    if ( err ) {

      log.e( 'Unexpected error during check - Took : ' + moment.duration( checkEnd - checkStart ) );
      log.e( 'Unexpected error during check : ' + err );
      setTimeout( cbDone, pollInterval );
      
    } else {

      log.v( 'Check Complete : Found ' + parg.pdfFoundCount + ' new PDF entries in Queue : Took : ' + moment.duration( checkEnd - checkStart) );  
      setTimeout( cbDone, pollInterval );

    }
  });

}


function error( cbDone ) {

  log.e( ' Unexpected Error : ' + err );
  setImmediate( cbDone );

}


// perform polling check on F559811 lookingfor new entries to process at from status
function checkGetNewPdf( parg, next ) {

  parg.pdfFoundCount = 0;
  parg.processStatusFrom = processStatusFrom;
  parg.processStatusTo = processStatusTo;

  getnewpdf.getNewPdf( parg, function( err, result ) {

    if ( err ) {
      return next( err );
    }

    // Process each new PDF entry discovered
    async.eachSeries( 
      parg.newPdfRows, 
      function( row, cb ) {
      
        log.d( 'Row: ' + row );
        parg.newPdfRow = row;
        parg.newPdf = row[ 0 ];
        parg.newPdfStatus = row[ 1 ];

        // Same codebase used for Logo and Mail processing (depends on env variable parms)
        if ( parg.newPdfStatus == '100' ) {

          log.d( parg.newPdf + ' perform Logo processing' ); 
          dologo.doLogo( parg, function( err, result ) {

            if ( err ) {

              log.w( parg.newPdf + ' : Error trying to process for Logo ' );
              log.w( parg.newPdf + ' : Will try again hoping issue is temporary (network connectivity to DB or Aix printqueue) ' );
              return cb( err );

            } else {

              log.i( parg.newPdf + ' Logo processing Complete' ); 
              return cb( null );

            }
          });      

        } else {

          if ( parg.newPdfStatus == '200' ) {

            log.d( parg.newPdf = ' perform Mail processing ' ); 
            domail.doMail( parg, function( err, result ) { 

              if ( err ) {

                  log.w( parg.newPdf + ' : Error trying to process for Logo ' );
                  log.w( parg.newPdf + ' : Will try again hoping issue is temporary (network connectivity to DB or Aix printqueue) ' );
                  return cb( err );

                } else {

                  log.i( parg.newPdf + ' Mail processing Complete' ); 
                  return cb( null );

                }
            });      
          } else {

            log.e( parg.newPdf = ' perform What? Status Code not recognised - check docker environment arguments ' ); 

          }      
        }         
      },
      next );
  });
}

    
function initialisation() {

  // If poll Interval not supplied via environment variables then default it to 1 second
  if ( typeof( pollInterval ) === 'undefined' ) pollInterval = 1000;

  log.i( '' );
  log.i( '----- DLINK JDE PDF Queue Processor starting - ' + processInfo ); 
  log.i( '' );
  log.i( '----- JDE Environment    : ' + jdeEnv ); 
  log.i( '----- JDE Database       : ' + jdeEnvDb ); 
  log.i( '' );
  log.i( '----- Polling Interval   : ' + pollInterval ); 
  log.i( '' );
  log.i( '----- Pick up Queue entries at Status   : ' + processStatusFrom ); 
  log.i( '----- Move Queue entries to Status      : ' + processStatusTo ); 
  log.i( '' );
  log.i( '----- Monitor the JDE PDF Process Queue (F559811) for new PDF files at status ' + processStatusFrom );
  log.i( '----- Process them then move them to next status ' + processStatusTo );
  log.i( '' );

}  

