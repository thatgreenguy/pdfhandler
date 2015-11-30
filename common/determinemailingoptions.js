var log = require( './logger.js' ),
  verConfig = [],
  rptConfig =[],
  mailConfig =[],
  tmpOpt,  
  verrow,
  rptrow,
  versionOption,
  versionValue,
  reportOption,
  reportValue,
  index;


// Mailing Options will be a combination of Report Level Mailing Options
// merged with Version Level Mailing Options
// 
// Check Report Options first
// If the Report option is not present in Version Options then add it to Mail Options
// as it has not been overridden then add in version override options and return result
//
module.exports.determineMailingOptions = function( rptConfig, verConfig ) {

  mailConfig = [];


  logValues( 'Before:', rptConfig, verConfig, mailConfig );

  for ( var prop in rptConfig ) {

    if ( rptConfig.hasOwnProperty( prop ) ) {

      // Set option and value for current Report Mailing Option
      rptrow = rptConfig[ prop ];
      reportOption = rptrow[ 0 ];
      reportValue = rptrow[ 1 ];

      log.v( 'rptrow: ' + rptrow, ' reportOption: ' + reportOption + ' reportValue: ' + reportValue );

      // Check to see if this Reort Option exists in Version Config
      index = findOption( reportOption, verConfig );

      if ( index > -1 ) {

        log.d( 'FOUND : Report Option replaced with Version Overrides Option ' );
        log.d( '      : Report Option : ' + rptrow );
        log.d( '      : Version Option : ' + verConfig[ index ] );

      } else {

        log.d( 'NOT FOUND : Report Option should be used as no Version Overrides Option ' );
        log.d( '          : Report Option : ' + rptrow );
        mailConfig.push( rptrow );

      };
    }
  }

  logValues( 'Intermediate:', rptConfig, verConfig, mailConfig );

  // At this point mailConfig only holds email options from Report Config level where no version overrides exist
  // Now need to add all version overrides 
  tmpOpt = mailConfig.concat( verConfig );
  mailConfig = tmpOpt;

  logValues( 'After:', rptConfig, verConfig, mailConfig );
  
  log.d( 'Array to Obj: ' + mailConfig );

  // Now final Mailing Options determined return them as an object
  return { 'mailOptionsArray': mailConfig, 'mailOptionsObject': finalMailingOptions( mailConfig ) };

}


// Accepts array holding final merged results of Report and Version options
// returns same data in object format
//
function finalMailingOptions( mailConfig ) {

  var finalMailOptions = {};

  log.d( 'foEach working with: ' + mailConfig );

  mailConfig.forEach( function( row ) {

    log.d( 'foEach: ' + row );

    finalMailOptions[ row[ 0 ] ] = row[ 1 ];

  });

  return finalMailOptions;
 
}


// Search configuration (Report or Version) for a particular option  e.g. 'EMAIL_TO'
// Provide mailing option to search for and a config array of mailing options to search
// Returns index of match or -1 if not found
//
function findOption( search, cfg ) {
 
  var i = 0;

  log.d( 'Searching for option : ' + search + ' in ' + cfg );       

  for ( var p in cfg ) {

    if ( cfg.hasOwnProperty( p ) ) {
        
        row = cfg[ p ];
        cfgOption = row[ 0 ];
        cfgValue  = row[ 1 ];
   
        if ( cfgOption === search ) {

          log.d( 'Match: Search Option found at : ' + i );
          return i;

        }       
        i += 1 ;    
    }
  }
  return -1;
}


// Provide mailing option to search for and a config array of mailing options to search
// Returns index of match or -1 if not found
function logValues( msg, rpt, ver, mail ) {

 log.d( '' );
 log.d( msg + ' ----------' );
 log.d( 'Report Options  : ' + rpt );
 log.d( 'Version Options : ' + ver );
 log.d( 'Mailing Options : ' + mail );
 log.d( '' );

}
