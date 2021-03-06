// pdfhandler.js  : Monitor the JDE PDF process Queue handling post Pdf processing requirements such as Logos or Mailing   
// Author         : Paul Green
// Date           : 2015-09-10
//
// Synopsis
// --------
//
// Establish remote mount connectivity via sshfs to the Jde PrintQueue directory on the (AIX) Enterprise server
// Perform high frequency polling of the Oracle (JDE) table which holds PDF file entries queued for processing
// When detecting new JDE PDF files that are waiting for Post PDF processing e.g. Logos, Email 
// then call the appropriate handler to add logos or email the report 


var log = require( './common/logger.js' ),
  ondeath = require( 'death' )({ uncaughtException: true }),
  moment = require( 'moment' ),
  odb = require( './common/odb.js' ),
  mounts = require( './common/mounts.js' ),
  pdfchecker = require( './pdfchecker.js' ),
  poolRetryInterval = 30000,
  pollInterval = process.env.PROCESS_POLLINTERVAL,
  dbp = null,
  hostname = process.env.HOSTNAME,
  processInfo = process.env.PROCESS_INFO,
  processFromStatus = process.env.PROCESS_STATUS_FROM,
  processToStatus = process.env.PROCESS_STATUS_TO,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


startQueueProcessor();


// Functions
//
// startQueueProcessor()
// establishPool() 
// processPool( err, pool ) 
// performPolledProcess() 
// performPostRemoteMountChecks( err, data ) 
// scheduleNextPolledProcess() 
// reconnectToJde( err ) 
// performPostEstablishRemoteMounts( err, data ) 
// endMonitorProcess( signal, err ) 
// releaseOracleResources( suggestedExitCode ) 


// Do any startup / initialisation stuff
function startQueueProcessor() {

  if ( typeof( processInfo ) === 'undefined' ) processInfo = 'Process ' + processFromStatus + ' to ' + processToStatus
  if ( typeof( pollInterval ) === 'undefined' ) pollInterval = 2000

  log.i( '' );
  log.i( '----- DLINK JDE PDF Queue Processor Started - ' + processInfo ); 
  log.i( '' ); 
  log.i( 'JDE Environment : ' + jdeEnv );
  log.i( 'JDE Database : ' + jdeEnvDb );
  log.i( '' ); 
  log.i( 'Polling Interval : ' + pollInterval);
  log.i( '' ); 
  log.i( 'Pick up Queued PDF files at status ' + processFromStatus + ' - process then - move to status ' + processToStatus ); 
  log.i( '' );

  // Handle process exit from DOCKER STOP, system interrupts, uncaughtexceptions or CTRL-C 
  ondeath( endMonitorProcess );

  // First need to establish an oracle DB connection pool to work with
  establishPool();

}


// Establish Oracle DB connection pool
function establishPool() {

  odb.createPool( processPool );

}


// Check pool is valid and continue otherwise pause then retry establishing a Pool 
function processPool( err, pool ) {

  if ( err ) {

    log.e( 'Failed to create an Oracle DB Connection Pool will retry shortly' );
    
    setTimeout( establishPool, poolRetryInterval );    
 
  } else {

    log.v( 'Oracle DB connection pool established' );
    dbp = pool;

    performPolledProcess();
    
  }

}


// - Functions
//
// Initiates polled process that is responsible for applying logo images to new Jde Pdf files
function performPolledProcess() {

  // Check remote mounts to Jde Pdf files are working then process
  mounts.checkRemoteMounts( performPostRemoteMountChecks );

}


// Called after remote mounts to Jde have been checked
function performPostRemoteMountChecks( err, data ) {

  if ( err ) {

    // Problem with remote mounts so need to reconnect before doing anything else
    reconnectToJde( err );

  } else {

    // Remote mounts okay so go ahead and process, checking for new Pdf's etc
    pdfchecker.queryJdePdfProcessQueue( dbp, hostname, processFromStatus, processToStatus, scheduleNextPolledProcess );

  }

}


// Handles scheduling of the next run of the frequently polled process 
function scheduleNextPolledProcess() {

  setTimeout( performPolledProcess, pollInterval );

}


// Problem with remote mounts to jde so attempt to reconnect 
function reconnectToJde( err ) {

    log.d( 'Error data: ' +  err );
    log.w( 'Issue with Remote mounts to JDE - Attempting to reconnect.' );

    mounts.establishRemoteMounts( performPostEstablishRemoteMounts );

}


// Called after establish remote mounts to Jde has been processed
function performPostEstablishRemoteMounts( err, data ) {

  if ( err ) {

    // Unable to reconnect to Jde at the moment so pause and retry shortly
    log.w( '' );
    log.w( 'Unable to re-establish remote mounts to Jde will pause and retry' );
    log.w( '' );
    setTimeout( performPolledProcess, pollInterval );

  } else {

    // Remote mounts okay so go ahead and process, checking for new Pdf's etc
    log.v( 'Remote mounts to Jde re-established - will continue normally')
    pdfchecker.queryJdePdfProcessQueue( dbp, hostname, processFromStatus, processToStatus, scheduleNextPolledProcess );

  }

}




// EXIT HANDLING
//
// Note: DOCKER STOP or CTRL-C is not considered a failed process - just a way to stop this application - so node exits with 0
// An uncaught exception is considered a program crash so exists with code = 1
function endMonitorProcess( signal, err ) {

  if ( err ) {
   
    log.e( 'Received error from ondeath?' + err ); 

    releaseOracleResources( 2 ); 


  } else {

    log.e( 'Node process has died or been interrupted - Signal: ' + signal );
    log.e( 'Normally this would be due to DOCKER STOP command or CTRL-C or perhaps a crash' );
    log.e( 'Attempting Cleanup of Oracle DB resources before final exit' );
  
    releaseOracleResources( 0 ); 

  }

}


// Check to see if database pool is valid and if so attempt to release Oracle DB resources back to the Database
// This function can be called from endMonitorProcess or if a database related error is detected
// If unable to release resources cleanly application will exit with non-zero code (connections not released correctly?) 
function releaseOracleResources( suggestedExitCode ) {

  log.e( 'Problem detected so attempting to release Oracle DB resources' );
  log.e( 'Application may exit or wait briefly and attempt recovery' );

  // If no exit code passed in default it to exit with 0
  if ( typeof( suggestedExitCode ) === 'undefined' ) { suggestedExitCode = 0 } 

  // Release Oracle resources
  if ( dbp ) {

    odb.terminatePool( dbp, function( err ) {

      if ( err ) {

        log.d( 'Failed to release Oracle DB Connection Pool resources: ' + err );

        dbp = null;
        process.exit( 2 );

      } else {

        log.d( 'Oracle DB Connection Pool resources released successfully: ' );

        process.exit( suggestedExitCode );

      }
    });

  } else {

    log.d( 'No Oracle DB Connection Pool to release: ' );

    dbp = null;
    process.exit( suggestedExitCode );

  }

}
