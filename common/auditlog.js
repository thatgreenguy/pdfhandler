var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  jdeLogging = process.env.JDELOGGING,
  hostname = process.env.HOSTNAME,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  jdeEnvDbF556110 = process.env.JDE_ENV_DB_F556110,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.auditLog = function( pargs, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = { autoCommit:true },
    newPdf,
    jcfndfuf2 = pargs.newPdfRow[0],
    jcprocessid = pargs.newPdfRow[3],
    dt = new Date(),
    timestamp = audit.createTimestamp(dt),
    jdedate = audit.getJdeJulianDate(dt),
    jdetime = audit.getJdeAuditTime(dt),
    genkey;

  // If JDE Logging is disabled simply return 
  if ( jdeLogging != 'Y' ) {

    return cbWhenDone( null );
    
  } else {

  
  // Ensure comments field has not busted maximum field size 256 if so reduce it to prevent DB error
  if ( pargs.comments.length > 255 ) {

    log.w( pargs.newPdf + ' auditLog: Detected passed comments length is too great for INSERT to F559859 : Reducing to fit' );
    log.w( pargs.newPdf + ' auditLog: was : ' + pargs.comments );
    pargs.comments = pargs.comments.substring( 0, 256 );
    log.w( pargs.newPdf + ' auditLog: now : ' + pargs.comments );

  }


  genkey = jdedate + ' ' + jdetime;
  newPdf = pargs.newPdfRow[ 0 ];
  log.d( newPdf + ' : Get Connection for Insert' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( newPdf + ' : Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    sql = "INSERT INTO " + jdeEnvDb.trim() + ".F559859 VALUES (:pasawlatm, :pafndfuf2, :pablkk, :paactivid, :padeltastat, :pacomments, :papid, :pajobn, :pauser, :paupmj, :paupmt)";
    binds = [ timestamp, newPdf, genkey, hostname, pargs.processStatusFrom, pargs.comments, 'PDFHANDLER', 'CENTOS', 'DOCKER', jdedate, jdetime ]
    options = { autoCommit: true } 
    log.debug( sql );

    dbc.execute( sql, binds, options, function( err, result ) {

      if ( err ) {
        log.e( newPdf + ' : Jde Db Query insert failed : ' + err );
        dbc.release( function( err ) {
          if ( err ) {
            log.e( newPdf + ' : Unable to release Jde Db connection : ' + err );
            return cbWhenDone( err );
          }
        });     
        return cbWhenDone( err );
      }  

      dbc.release( function( err ) {
        if ( err ) {
          log.e( newPdf + ' : Unable to release Jde Db connection : ' + err );
          return cbWhenDone( err );
        }
        return cbWhenDone( null, pargs.newPdf + ' Locked' );
      });          
    });
  });

  }
}




module.exports.auditLogMailOptions = function( pargs, cbWhenDone ) {

  async.forEachOfSeries( pargs.mailOptionsArray, 
    function( option, key, callback ) {

      pargs.comments = '' + option;      
      module.exports.auditLog( pargs, function( err, res ) {

        if ( err ) {

          return callback( err );

        } else {

          return callback( null );

        }
      });

    },
    function( err ) {

      if ( err ) {
        return cbWhenDone( err );
      } else {
        return cbWhenDone( null );
      }
 
    }); 
}
