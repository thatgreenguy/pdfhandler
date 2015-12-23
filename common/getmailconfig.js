var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  determinemailingoptions = require( './determinemailingoptions.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.getMailConfig = function(  parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    wka,
    rowCount,
    configVersion = [],
    configReport = [],
    ver,
    opt,
    val,
    wka,
    tmpobj;


  // Replace Split of passed PDF name extracting Report and Version name elements with retrieving Report and Version name elements from Blob in Job Control record because 
  // the data in the blob (Version Name) is NOT truncated when job number starts getting longer.
  
  wka = parg.newPdf.split("_");
  parg.pdfReportName = wka[0];
  parg.pdfVersionName = wka[1];

  log.v( parg.newPdf + ' : Report Name : ' + parg.pdfReportName );
  log.v( parg.newPdf + ' : Version Name : ' + parg.pdfReportName );

  // Setting PDF Report Name and Version by splitting PDF Job string 'Rxxxxxx_Vxxxxxx_1234546_PDF' doesn't work long term because as the Job Number
  // grows the JDE system starts to truncate the Version Name. Luckily the Job Control record has a blob which contains the full report name and version name
  // So use them instead to ensure we always read the correct Mail configuration
  parg.pdfReportName = parg.fullReportName;
  parg.pdfVersionName = parg.fullVersionName;

  log.v( parg.newPdf + ' : Full Report Name : ' + parg.pdfReportName );
  log.v( parg.newPdf + ' : Full Version Name : ' + parg.pdfReportName ); 

  // Set Email to No prior to checking Mail Configuration
  parg.mailOptions = { 'EMAIL': 'N' };

  log.d( parg.newPdf + ' : Report Name : ' + parg.pdfReportName );
  log.d( parg.newPdf + ' : Version Name : ' + parg.pdfVersionName );

  log.d( 'Get Connection to query for any Mail configuration setup ' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( ' Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    // Pull any PDFMAIL configuration entries for the current PDF - there could be None, 1 or many entries
    // None = No Mail processing required so signal to update status to 999 'Complete'
    // If 1 or more entries then need to examine them in detail as Version level entries can override Report level ones.
  
    sql = "SELECT crvernm, crblkk, crtaskmisc  FROM " + jdeEnvDb.trim() + ".F559890 WHERE crcfgsid = 'PDFMAIL' AND crpgm = '";
    sql += parg.pdfReportName + "' AND ( crvernm = '" + parg.pdfVersionName + "' OR crvernm = '*ALL' ) ORDER BY CRBLKK, CRVERNM, CRSEQ" ;
    log.d( sql );
    dbc.execute( sql, binds, options, function( err, result ) {

      if ( err ) {
        log.e( ' Jde Db Query execution failed : ' + err );
        dbc.release( function( err ) {
          if ( err ) {
            log.e( ' Unable to release Jde Db connection : ' + err );
            return cbWhenDone( err );
          }
        });     
        return cbWhenDone( err );
      }  

      // Check returned rows set sendEmail indicator and merge Report level and version level configuration options 
      // Options can be configured at Report level or Version Level and if same option is configured at both levels then
      // Version level option trumps or overrides the report level one

      rows = result.rows;
      rowCount = result.rows.length;

      if ( rowCount > 0 ) {
 
        // We have some configuration options so could be sending email here but depends on the 'EMAIL' option being Y or N
        // First sort config options into Report or Version level
        
        for ( var i = 0; i < rowCount; i++ ) {

          row = result.rows[ i ];
          ver = row[ 0 ].trim();
          opt = row[ 1 ].trim();
          val = row[ 2 ];
          wka = [ opt, val ];
          
          // Is read mail config option Report or Version level?
          if ( ver == parg.pdfVersionName ) {
            configVersion.push( wka );
          } else {
            configReport.push( wka );
          }
        }

        // Report and Version options are now segregated
        // Now need to merge both sets of options respecting version options 
        // to determine the actual mailing options that should apply to this Report/Version

        tmpobj = null;
        tmpobj = determinemailingoptions.determineMailingOptions( configReport, configVersion );          
        parg.mailOptions = tmpobj.mailOptionsObject;
        parg.mailOptionsArray = tmpobj.mailOptionsArray;

        // We have applicable Mailing Options for this Report Version so check the 'EMAIL' option and set
        // whether we are sending email for this report/version or not

        log.v( parg.newPdf + ' Mailing Options: ' + JSON.stringify( parg.mailOptions ) );
      
      } else {

        // No PDFMAIL config at all for this Report/Version so definitely not sending email here - return to caller
        log.d( parg.newPdf + ' : No PDFMAIL config found ' );

      }
     
      // Ensure conenction resource released then return
      dbc.release( function( err ) {
        if ( err ) {
          log.e( ' Unable to release Jde Db connection : ' + err );
          return cbWhenDone( err );
        }
        return cbWhenDone( null, row );
      });          
    });
  });

}
