// Module		: logoinfo.js
// Description		: Fetch PDFLOGO setup entries for current PDF entry
// Author		: Paul Green
// Dated		: 2015-11-19
//
// Checks PDFLOGO setup entries - if any - for current PDF being checked/processed
// If no entries then LOGO processing does not apply to this PDF 
// If 1 or 2 entries then extract Logo image to use and x,y coordinates for placement and signal LOGO processing shold be performed
// If more than 2 entries then setup is wrong and only first 2 setup entries will be considered


var oracledb = require( 'oracledb' ),
  async = require( './async' ),
  odb = require( './odb.js' ),
  log = require( './logger.js' );


// Functions -
//
// module.exports.checkPdflogoSetup = function( p, cbWhenDone ) 


// check PDFLOGO setup entries in JDE for current PDF - extract Report name and Version and return via p wehther
// Logo should be applied or not and if so what image and x,y coordinates to use 
module.exports.checkPdflogoSetup = function( p, cbWhenDone ) {

  async.series([
    function( next ) { splitPdfName( p, next ) },
    function( next ) { fetchLogoVersionSetup( p, next ) },
    function( next ) { fetchLogoReportSetup( p, next ) }
  ], function( err, res ) {

    if ( err ) {

      log.e( 'PDF ' + p.pdf + ' Failed fetching PDFLOGO Setup ' + err );
      log.e( 'PDF ' + p.pdf + err );

      return cbWhenDone;

    } else { 

      log.d( 'PDF ' + p.pdf + ' Fetched PDFLOGO Setup OK ' );
      log.d( 'PDF ' + p.pdf + res );

      return cbWhenDone;

    }
  });
}


// Extract Report and version name components of PDF entry name - make available in p 
function splitPdfName = function( p, cb ) {

  var wka;

  wka = p.pdf.split("_");

  p.pdfReportName = wka[0];
  p.pdfVersionName = wka[1];

  log.d( 'Splitting PDF Name : ' + p.pdf );
  log.d( 'Splitting PDF Name : Report is : ' + p.pdfReportName );
  log.d( 'Splitting PDF Name : Version is : ' + p.pdfVersionName );

  return cb;  

}


// Check for PDFLOGO version override setup entry for the current PDF entry being processed
// If found then Logo should be applied using retrieved image name and coordinates
function fetchLogoVersionSetup = function( p, cb ) {

  var query,
  binds = [],
  count = 0;

  query = "SELECT crtaskmisc FROM jdeEnvDb.F559890 WHERE crpgm = '";
  query += p.pdfReportName + "' AND crvernm = '" + p.pdfVersionName + "'";

  log.d( 'PDF ' + p.pdf + ' : ' + query );

  p.dbc.execute( query, [], { }, function( err, rs ) {
        
  if ( err ) { 

    log.d( 'PDF ' + p.pdf + ' : DB Error unable to fetch PDFLOGO Setup records' );
    log.d( 'PDF ' + p.pdf + ' : ' + err.message );

    return cb( err );

  } else {

    count = rs.rows.length;
    log.d( 'PDF ' + p.pdf + ' : Found ' + count + ' PDFLOGO setup records' );

    // PDFLOGO setup records - there could be none, 1 or 2
    // If more than 2 just consider first 2 as only supposed to create a report level and/or version level entry
    // for Logo processing - Note: version setup overrides report setup


    if ( count > 0 ) {

      p.applyLogo = 'Y'

      log.d( 'PDF ' + p.pdf + ' : PDFLOGO Version override found' );
      log.d( 'PDF ' + p.pdf + ' : Row data : ' + rs.rows[ 0 ] );
        
      p.logoImage = '';
      p.logoX = 1;
      p.logoY = 1;

    } else { 

      log.d( 'PDF ' + p.pdf + ' : No PDFLOGO Version override' );

      p.applyLogo = 'N'
     
    }

    return cb( null );

  }
}


// Check for PDFLOGO '*ALL' setup entry for the current PDF entry being processed
// If found then Logo should be applied using retrieved image name and coordinates
function fetchLogoReportSetup = function( p, cb ) {

  var query,
  binds = [],
  count = 0;

  // If already determined that we are applying a Logo then skip the default *ALL check
  // as specific Version override already found
  if ( p.applyLogo === 'Y' ) {

    return cb( null );

  } else {

    // If no version override in force then check the default *ALL to see if LOGO should be applied to this Report
    query = "SELECT crtaskmisc FROM jdeEnvDb.F559890 WHERE crpgm = '";
    query += p.pdfReportName + "' AND crvernm = '*ALL' ";

    log.d( 'PDF ' + p.pdf + ' : ' + query );

    p.dbc.execute( query, [], { }, function( err, rs ) {
         
    if ( err ) { 

      log.d( 'PDF ' + p.pdf + ' : DB Error unable to fetch PDFLOGO Setup records' );
      log.d( 'PDF ' + p.pdf + ' : ' + err.message );

      return cb( err );

    } else {

      count = rs.rows.length;
      log.d( 'PDF ' + p.pdf + ' : Found ' + count + ' PDFLOGO setup records' );

      // PDFLOGO setup records - there could be none, 1 or 2
      // If more than 2 just consider first 2 as only supposed to create a report level and/or version level entry
      // for Logo processing - Note: version setup overrides report setup

      if ( count > 0 ) {

        p.applyLogo = 'Y'

        log.d( 'PDF ' + p.pdf + ' : PDFLOGO *ALL setup entry found' );
        log.d( 'PDF ' + p.pdf + ' : Row : ' + rs.rows[ 0 ] );
        
        p.logoImage = '';
        p.logoX = 1;
        p.logoY = 1;

      } else { 

        log.d( 'PDF ' + p.pdf + ' : No PDFLOGO setup found' );
        p.applyLogo = 'N'

      }

      return cb( null );  

    }
  }
}
