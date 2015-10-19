// Module		: audit.js
// Description		: Common Audit file logging related functions.
// Author		: Paul Green
// Dated		: 2015-08-03
//
// Common mostly Audit related functions. Application writes detailed audit logs - see /logs but also creates basic informational
// auditing within JDE showing application startup and PDF files processed
// JDE date and time functions and time adjustment used for handling time offset between AIX server and application server.
  

var oracledb = require( 'oracledb' ),
  log = require( './logger' ),
  moment = require( 'moment' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


// Functions -
// 
// exports.createAuditEntry = function( dbc, pdfjob, genkey, ctrid, status, cb ) 
// exports.updatePdfQueueStatus = function( dbc, pdfjob, genkey, ctrid, status, cb ) 
// exports.createTimestamp = function( dt, dateSep, timeSep, padChar ) 
// exports.getJdeJulianDate = function( dt ) 
// exports.getJdeAuditTime = function( dt, padChar ) 
// exports.adjustTimestampByMinutes = function( timestamp, mins ) 
//


// Insert new Audit entry into the JDE audit log file.
exports.createAuditEntry = function( dbc, pdfjob, genkey, ctrid, status, comments, cb ) {

  var dt,
  timestamp,
  jdedate,
  jdetime,
  query,
  binds,
  options;

  dt = new Date();
  timestamp = exports.createTimestamp( dt );
  jdedate = exports.getJdeJulianDate( dt );
  jdetime = exports.getJdeAuditTime( dt );

  query = "INSERT INTO " + jdeEnvDb.trim() + ".F559859 VALUES (:pasawlatm, :pafndfuf2, :pablkk, :paactivid, :padeltastat, :pacomments, :papid, :pajobn, :pauser, :paupmj, :paupmt)";
  binds = [ timestamp, pdfjob, genkey, ctrid, status, comments, 'PDFHANDLER', 'CENTOS', 'DOCKER', jdedate, jdetime ]
  options = { autoCommit: true }

  log.d( query );

  dbc.execute( query, binds, options, function( err, result ) {
      if ( err ) {
        log.error( err.message );
        return cb( err );
      }

     return cb( null ); 
 
  });
}


// Update Jde PDF process Queue status from current status to new status 
// Called after Logo processing completes okay to move from say 100 to (Next Status) 200
// Or after Mail processing okay to move from 200 to 999 (post PDF processing complete)
exports.updatePdfQueueStatus = function( dbc, pdfjob, genkey, ctrid, status, cb ) {

  var dt,
  timestamp,
  jdedate,
  jdetime,
  query,
  binds,
  options;

  dt = new Date();
  timestamp = exports.createTimestamp( dt );
  jdedate = exports.getJdeJulianDate( dt );
  jdetime = exports.getJdeAuditTime( dt );

  query = "UPDATE " + jdeEnvDb.trim() + ".F559811 SET jpyexpst = '" + status + "' WHERE jpfndfuf2 = '" + pdfjob + "'";
  binds = [ ]
  options = { autoCommit: true }

  log.d( query );

  dbc.execute( query, binds, options, function( err, result ) {
      if ( err ) {
        log.error( err.message );
        return cb( err );
      }

     return cb( null ); 
 
  });
}


// Create human readable timestamp string suitable for Audit Logging - Returns timestamp string like 'YYYY-MM-DD T HH:MM:SS MMMMMMMMM'
// Date and time elements are padded with leading '0' by default. Date and Time separator characters are '-' and ':' by default.
// MMMMMMMMM is time as milliseconds since epoch to keep generated string unique for same second inserts to Audit Log table. 
exports.createTimestamp = function( dt, dateSep, timeSep, padChar ) {

  if ( typeof( dt ) === 'undefined' ) dt = new Date();
  if ( typeof( dateSep ) === 'undefined' ) dateSep = '-';
  if ( typeof( timeSep ) === 'undefined' ) timeSep = ':';
  if ( typeof( padChar ) === 'undefined' ) padChar = '0';
  
  return dt.getFullYear() + dateSep + ( padChar + ( dt.getMonth() + 1 ) ).slice( -2 ) + dateSep + ( padChar + dt.getDate() ).slice( -2 )
    + ' T ' + ( padChar + dt.getHours() ).slice( -2 ) + timeSep + ( padChar + dt.getMinutes() ).slice( -2 ) + timeSep
    + ( padChar + dt.getSeconds() ).slice( -2 ) + ' ' + dt.getTime();
}


// Converts date to JDE Julian style date i.e. CYYDDD
exports.getJdeJulianDate = function( dt ) {

  var wkM,
    wkYYYY,
    wkDDD;

  if ( typeof( dt ) === 'undefined' ) dt = new Date();

  wkM = moment( dt );

  wkYYYY = wkM.year();
  wkDDD = wkM.dayOfYear();
  return wkYYYY - 1900 + ( '000' + wkDDD).slice( -3 );

}


// Convert date to JDE Audit Time HHMMSS - Return jde Audit time in format HHMMSS with no separators and leading 0's if required.
exports.getJdeAuditTime = function( dt, padChar ) {

  var jdetime;

  if ( typeof( dt ) === 'undefined' ) dt = new Date();
  if ( typeof( padChar ) === 'undefined' ) padChar = '0';

  jdetime = ( padChar + dt.getHours() ).slice( -2 ) + ( padChar + dt.getMinutes() ).slice( -2 ) + ( padChar + dt.getSeconds() ).slice( -2 );

  return jdetime;
}


// Reduce audit timestamp value by x minutes and return adjusted value plus Jde date and Time equivalents
// Accepts timestamp string (from audit file) and returns date adjusted by x minutes
// as well as JDE Julian Date and JDE Julian Time Audit value equivalants 
exports.adjustTimestampByMinutes = function( timestamp, mins ) {

  var millisecs = null,
  n = null,
  dt = new Date(),
  adjdt = null,
  newdt,
  newtm;
	
  // Date and Time should be passed if not set to zeros and return adjusted by minutes value
  if ( typeof( mins ) === 'undefined' ) mins = -5;
  if ( typeof( timestamp ) !== 'undefined' ) {
    millisecs = timestamp.substr( 22, 13 );
    n = parseInt( millisecs );
    dt = new Date( n );
  }

  // Get timestamp date adjusted by however minutes
  adjdt = new Date( dt.setMinutes( dt.getMinutes() + mins ) );
	
  // Return Jde Julian style Date and Times 
  newdt = module.exports.getJdeJulianDate( adjdt );
  newtm = module.exports.getJdeAuditTime( adjdt );

  return {'jdeDate': newdt, 'jdeTime': newtm, 'timestamp': dt, 'minutes': mins };
}
