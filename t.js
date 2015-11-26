var async = require( 'async' ),
  moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  audit = require( './common/audit.js' ),
  getlastpdf = require( './getlastpdf.js' ),
  getnewpdf = require( './getnewpdf.js' ),
  addnewpdf = require( './addnewpdf.js' ),
  pdfinqueue = require( './pdfinqueue.js' ),
  processInfo = process.env.PROCESS_INFO,
  processStatusFrom = process.env.PROCESS_STATUS_FROM,
  processStatusTo = process.env.PROCESS_STATUS_TO,
  pollInterval = process.env.POLLINTERVAL,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  jdeEnvDbF556110 = process.env.JDE_ENV_DB_F556110;



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
// function checkGetLastPdf( parg, next ) 
// function checkGetJdeDateTime( parg, next ) 
// function checkSetMonitorFrom( parg, next ) 
// function checkGetNewPdf( parg, next ) 
// function initialisation() 


function check( cbDone ) {

  var parg = {},
    checkStart,
    checkEnd;

  checkStart = moment();
  log.d( ' Perform Check ( every ' + pollInterval + ' milliseconds )' );

  async.series([
    function( next ) { checkRemoteMounts( parg, next )  },
    function( next ) { checkGetJdeDateTime( parg, next )  },
    function( next ) { checkSetMonitorFrom( parg, next )  },
    function( next ) { checkGetNewPdf( parg, next )  }
  ], function( err, res ) {

    checkEnd = moment();
    if ( err ) {

      log.e( 'Unexpected error during check - Took : ' + moment.duration( checkEnd - checkStart ) );
      log.e( 'Unexpected error during check : ' + err );
      setTimeout( cbDone, pollInterval );
      
    } else {

      log.v( 'Check Complete : Added ' + parg.pdfAddCount + ' new PDF entries to Queue : Took : ' + moment.duration( checkEnd - checkStart) );  
      if ( parg.pdfAddErrorCount > 0 ) {
        log.v( 'Check Complete : Failed to Add ' + parg.pdfAddErrorCount + ' PDF entries to Queue - already added?' );  
      }
      setTimeout( cbDone, pollInterval );

    }
  });

}


function error( cbDone ) {

  log.e( ' Unexpected Error : ' + err );
  setImmediate( cbDone );

}


function checkGetLastPdf( parg, next ) {

  getlastpdf.getLastPdf( parg, function( err, result ) {

    if ( err ) {
      return next( err );
    }

    log.v( 'Last PDF processed : ' + result );
    parg.lastPdfRow = result;
    return next( null );

  });
}    


function checkGetJdeDateTime( parg, next ) {

  getjdedatetime.getJdeDateTime( parg, function( err, result ) {

    if ( err ) {
      return next( err );
    }

    log.v( 'JDE (Aix) current System Date/Time : ' + result );
    return next( null );

  });
}    


function checkSetMonitorFrom( parg, next ) {

  var jdeMoment;

  // Monitoring of the JDE job Control table is done from a particular Date and Time.
  // Usually the last PDF added to the process queue (F559811) determines this date and time
  // Idea is that as each new PDF is added to the process queue then the monitor query checks from that point forwards (keeps the query light)
  // However, if the F559811 is cleared (or empty on first run) then as fallback use the current JDE System Date and Time as the start point for monitoring
  // Once a new PDF is detected and added to the process queue then monitoring will continue from that point

  if ( parg.monitorFromDate === 0 ) {

    log.i( 'Last PDF check did not manage to set Monitor From Date and Time - F559811 file empty/cleared?' );
    log.i( 'As fallback - start monitoring from current AIX (JDE System) Date and Time - until next PDF added to F559811 Process Queue' );

    // Save AIX (JDE) Current System Date and Time in human readable format then convert monitor from date/time to JDE format
    // Factor in a safety offset window of 60 seconds as sometimes monitoring query runs just before trigger data is copied from F986110 to F556110
    parg.aixDateTime = parg.jdeDate + ' ' + parg.jdeTime;
    jdeMoment = moment( parg.aixDateTime ).subtract( monitorTimeOffset, 'seconds' );
    parg.monitorFromDate = audit.getJdeJulianDateFromMoment( jdeMoment );
    parg.monitorFromTime = jdeMoment.format( 'HHmmss' );

  }

  log.v( 'Monitor for new PDF entries from : ' + parg.monitorFromDate + ' ' + parg.monitorFromTime );
  return next( null );

}    


function checkGetNewPdf( parg, next ) {

  parg.pdfAddCount = 0;
  parg.pdfAddErrorCount = 0;

  getnewpdf.getNewPdf( parg, function( err, result ) {

    if ( err ) {
      return next( err );
    }

    log.v( 'New PDF entries : ' + parg.newPdfRows );

    async.eachSeries( 
      parg.newPdfRows, 
      function( row, cb ) {
      
        log.d( 'Row: ' + row );
        parg.checkPdf = row[ 0 ];
        parg.newPdfRow = row;


        pdfinqueue.pdfInQueue( parg, function( err, result ) {

          if ( err ) {

            log.e( parg.checkPdf + ' Error - Unable to verify if in Queue or not ' );
            return cb( err );

          } else {

            if ( parg.pdfInQueue >= 1 ) {
              log.d( parg.checkPdf + ' PDF already in Queue - Ignore it ' );
              return cb( null );

            } else {
              log.d( parg.checkPdf + ' PDF is new add to JDE Process Queue ' );

              addnewpdf.addNewPdf( parg, function( err, result ) {

                if ( err ) {

                  parg.pdfAddErrorCount += 1;
                  log.e( row[ 0 ] + ' : Failed to Add to Jde Process Queue : ' + err );
                  return cb( null);            

                } else {

                  parg.pdfAddCount += 1;
                  log.i( row[ 0 ] + ' : New PDF Added to Jde Process Queue ' );
                  return cb( null );
                }      
              });
            }        
          }
        });
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
  log.i( '----- JDE Job Control DB : ' + jdeEnvDbF556110 ); 
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

