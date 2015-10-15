// Module		: lock.js
// Description		: Common PDF file locking related functions.
// Author		: Paul Green
// Dated		: 2015-08-04
//
// If running multiple docker container apps need a way to ensure a Pdf file is only processed by
// one application hence simple locking strategy employed here.

  
var odb = require('./odb.js'),
  audit = require( './audit.js' ),
  log = require( './logger.js' );


// Place Lock on PDF file
exports.placeLock = function( dbc, record, hostname, cb ) {

  var jcfndfuf2 = record[0],
    jcprocessid = record[3],
    dt = new Date(),
    timestamp = audit.createTimestamp(dt),
    jdetime = audit.getJdeAuditTime(dt),
    jdedate = audit.getJdeJulianDate(dt),
    jdetime = audit.getJdeAuditTime(dt),
    query,
    binds,
    options;

    query = "INSERT INTO testdta.F559858 VALUES (:lkfndfuf2, :lksawlatm, :lkactivid, :lkpid, :lkjobn, :lkuser, :lkupmj, :lkupmt)";
    binds = [ jcfndfuf2, timestamp, hostname, 'PDFHANDLER', 'CENTOS', 'DOCKER', jdedate, jdetime ]
    options = { autoCommit: true } 

    log.debug( query );

    dbc.execute( query, binds, options, function( err, result ) {
    
        if ( err ) {
          log.debug( 'Oracle DB Insert Lock Failure : ' + err.message );
          return cb( null, 'INUSE' );
        }

        // No error so Lock in place
        return cb( null, 'LOCKED' )
    });
}



// Remove Lock on PDF file
exports.removeContainerLock = function( dbp, record, hostname, cb ) {

  var jcfndfuf2 = record[ 0 ],
    jcprocessid = record[ 3 ],
    dt = new Date(),
    timestamp = audit.createTimestamp( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    jdedate = audit.getJdeJulianDate( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    query,
    binds,
    options;
log.v(JSON.stringify(dbc) );

    query = "DELETE FROM testdta.F559858 WHERE lkfndfuf2 = '" + jcfndfuf2  +"' AND lkactivid = '" + hostname + "'";
    binds = [];
    options = { autoCommit: true };

    log.debug( query );

    dbc.execute( query, binds, options, function( err, result ) {
      if ( err ) {
        log.debug( 'Oracle DB Delete Lock failure : ' + err );
        return cb( err );
      }
    });
}


// Remove Lock on PDF file
exports.removeLock = function( dbc, record, hostname, cb ) {

  var jcfndfuf2 = record[ 0 ],
    jcprocessid = record[ 3 ],
    dt = new Date(),
    timestamp = audit.createTimestamp( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    jdedate = audit.getJdeJulianDate( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    query,
    binds,
    options;
log.v(JSON.stringify(dbc) );

    query = "DELETE FROM testdta.F559858 WHERE lkfndfuf2 = '" + jcfndfuf2 + "'";
    binds = [];
    options = { autoCommit: true };

    log.debug( query );

    dbc.execute( query, binds, options, function( err, result ) {
      if ( err ) {
        log.debug( 'Oracle DB Delete Lock failure : ' + err );
        return cb( err );
      }
    });
}
