// Module		: mail.js
// Description		: Common Mail related functions.
// Author		: Paul Green
// Dated		: 2015-10-19
//
// Establish SMTP transport
// Provide function to send Jde Ube report (PDF, CSV or both) via emal to configured receipients


var nodemailer = require( 'nodemailer' ),
  async = require( 'async' ),
  log = require( './logger.js' ),
  smtpTransport,
  smtphost = process.env.MAIL_HOST,
  smtpport = process.env.MAIL_PORT,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


// Initialisation
//
// Default SMTP Host and PORT if not provided in environment variables
if ( typeof( smtphost ) === 'undefined' ) 
{
  log.w( 'No SMTP Host environment variable "SMTP_HOST" defined - defaulting to 172.31.3.15' )
  smtphost = '172.31.3.15'
}
if ( typeof( smtpport ) === 'undefined' ) 
{
  log.w( 'No SMTP Port environment variable "SMTP_PORT" defined - defaulting to 25' )
  smtpport = 25
}

// create re-usable transporter object using SMTP transport
//  host: '172.31.3.15',
//  port: 25
smtpTransport = nodemailer.createTransport( "SMTP", {
  host: smtphost,
  port: smtpport
});


// Functions -
//
// module.exports.prepMail = function( dbCn, jdeJob, postMailCb )
// function fetchMailDefaults( dbCn, jdeJob, postMailCb, useVersion, reportOptions, versionOptions )
// function queryJdeEmailConfig( dbCn, jdeJob, postMailCb, reportName, versionName, reportOptions, versionOptions ) 
// function processResultsFromF559890( dbCn, jdeJob, postMailCb, versionName, rsF559890, numRows, reportOptions, versionOptions ) 
// function processEmailConfigEntry( dbCn, jdeJob, postMailCb, rsF559890, record, versionName, reportOptions, versionOptions ) 
// function getVersionOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions ) 
// function mergeAllOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions ) 
// function mergeMailOptions( jdeJob, reportOptions, versionOptions, postMailCb ) 
// function processVersionOverrides( reportOptions, versionOptions, mailOptions, versionOption, cb ) 
// function removeOverrideOption( reportOptions, versionOptions, mailOptions, versionOption, reportOption, cb ) 
// module.exports.doMail = function( jdeJob, mailOptions, postMailCb ) 
// function oracleResultSetClose( connection, rs ) 
// function oracleDbConnectionRelease( connection ) 
// function cleanup() 
 

// Read email options from JDE database for this reprot then send the email
module.exports.prepMail = function( dbCn, jdeJob, postMailCb ) {

  var reportOptions = [],
    versionOptions = [];

  // Fetch default report mail options
  fetchMailDefaults( dbCn, jdeJob, postMailCb, false, reportOptions, versionOptions );

}


// Fetch default email configuration for given Jde report name.
function fetchMailDefaults( dbCn, jdeJob, postMailCb, useVersion, reportOptions, versionOptions ) {

  var reportName,
    versionName,
    tokens;

  // Extract Report name and Version name
  tokens = jdeJob.split('_');
  reportName = tokens[ 0 ];

  // For default Report options version name is '*ALL' - otherwise pass actual version name
  if ( useVersion ) {

    versionName = tokens[ 1 ];

  } else {

    versionName = '*ALL';

  }

  queryJdeEmailConfig( dbCn, jdeJob, postMailCb, reportName, versionName, reportOptions, versionOptions );

}


// Query the Jde Email Configuration Setup for this Report / Version.
function queryJdeEmailConfig( dbCn, jdeJob, postMailCb, reportName, versionName, reportOptions, versionOptions ) {

  var query;

  log.debug( 'Fetch email config for Report: ' + reportName + ' version: ' + versionName );

  query = "SELECT * FROM " + jdeEnvDb.trim() + ".F559890 WHERE CRPGM = '" + reportName;
  query += "' AND CRVERNM = '" + versionName + "'";
  query += " AND CRCFGSID = 'PDFMAIL'";
  
  log.debug( query ); 

  dbCn.execute( query, [], { resultSet: true }, 
  function( err, rs ) {
  
    if ( err ) {
    
      // Error trying to read mail config so return to caller with error handle it there
      log.error( 'Query Failed : queryJdeEmailConfig Failed' );
      log.error( err.message );
      return postMailCb( err );

    }
    
    processResultsFromF559890( dbCn, jdeJob, postMailCb, versionName, rs.resultSet, 1, reportOptions, versionOptions );     

  });
}


// Process results of query on F559890 Jde Email Config Setup
function processResultsFromF559890( dbCn, jdeJob, postMailCb, versionName, rsF559890, numRows, reportOptions, versionOptions ) {

  rsF559890.getRows( numRows, 
  function( err, rows ) {
    if ( err ) {

      oracleResultSetClose( dbCn, rsF559890 );
      log.verbose( 'No email configuration found' );
      return postMailCb( err )      

    } else if ( rows.length == 0 ) {
      
      oracleResultSetClose( dbCn, rsF559890 );
      log.debug( 'Finished processing email configuration entries' );

      // Done processing so pass control to next function with results
      if ( versionName === '*ALL' ) {
        getVersionOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions );
      } else {
        mergeAllOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions );
      }
      
    } else if ( rows.length > 0 ) {
 
      log.debug( 'Email Record: ' + rows[ 0 ] );

      // Process the Email Configuration record entry
      processEmailConfigEntry(  dbCn, jdeJob, postMailCb, rsF559890, rows[ 0 ], versionName, reportOptions, versionOptions );

    }
  });
}


// Process each Email Configuration entry
function processEmailConfigEntry( dbCn, jdeJob, postMailCb, rsF559890, record, versionName, reportOptions, versionOptions ) {

  log.i( 'Rptoptions: ' + reportOptions );
  log.i( 'Veroptions: ' + versionOptions );


  if ( versionName === '*ALL' ) {
    reportOptions.push([ record[ 3 ].trim(), record[ 5 ].trim() ]);
  } else {
    versionOptions.push([ record[ 3 ].trim(), record[ 5 ].trim() ]);
  }

  // Fetch next Email config entry
  processResultsFromF559890( dbCn, jdeJob, postMailCb, versionName, rsF559890, 1, reportOptions, versionOptions );     
    
}


// Read Version override options from JDE database then merge the two
function getVersionOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions ) {

  // Fetch report version override mail options
  fetchMailDefaults( dbCn, jdeJob, postMailCb, true, reportOptions, versionOptions );

}


// Merge both the Default options and any Version overrides to give final mail options 
function mergeAllOptions( dbCn, jdeJob, postMailCb, reportOptions, versionOptions ) {

  mergeMailOptions( jdeJob, reportOptions, versionOptions, postMailCb );

}




// Multiple email options can be defined for a Report and any of those options can be overridden at report/version level.
// This function takes the options for the report and those for the version overrides (if any) and returns a merged set of 
// options.
// if same option is defined at version level as at report level then the report level option is completely 
// replaced by the version override.
// Otherwise the result is a combination of report and version specific options.
function mergeMailOptions( jdeJob, reportOptions, versionOptions, postMailCb ) {

  log.i( 'reportoptions: ' + reportOptions );
  log.i( 'versionoptions: ' + versionOptions );


  var mailOptions = reportOptions.slice();

  // Show array before
  log.i( 'Before: ' + mailOptions )

  // Iterate over Version specific overrides and remove them from report mail options first
  async.each(
    versionOptions,
    async.apply( processVersionOverrides, reportOptions, versionOptions, mailOptions ),
    function ( err ) {
      if ( err ) {
        log.error( 'mergMailOptions encountered error' );
        log.error( err );
        return postMailCb( err );     
      }    
  
      // okay show results for amended Report options (removed version overrides)
     log.info( 'After: ' + mailOptions )

     // Now add in the version overrides and return final result
     mailOptions = mailOptions.concat( versionOptions );
    
    // dont send return results to caller let caller decide if error or options returned and handle appropriately 
    //sendMail( jdeJob, mailOptions, postMailCb );     

    return postMailCb( null, mailOptions ); 

    }   
  );
}


// Any Email option that has been overridden (by version) should be removed from report email options
function processVersionOverrides( reportOptions, versionOptions, mailOptions, versionOption, cb ) {

  // Iterate over Report email options and remove any matching the currentversion override option Type e.g. EMAIL_TO
  async.each(
    reportOptions,
    async.apply( removeOverrideOption, reportOptions, versionOptions, mailOptions, versionOption ),
    function ( err ) {
      if ( err ) {
        log.error( 'processVersionOverrides encountered error' );
        log.error( err );
        return cb( err );
      }
    }   
  );

  return cb( null );
}


// Check current Report options array element and remove it if it matches current Version option Type
function removeOverrideOption( reportOptions, versionOptions, mailOptions, versionOption, reportOption, cb ) {

  var vType,
    rType,
    index = 0;

  vType = versionOption[ 0 ];
  rType = reportOption[ 0 ];


  // If Report Email option Type matches the version override Type we are currently considering then remove it
  if ( vType === rType ) {

    log.debug( 'Match remove it: ' + vType + ' : ' + rType );

    index = mailOptions.indexOf( reportOption );
    if ( index > -1 ) { 

      mailOptions.splice( index, 1 );

    }
    
  } else { 

    log.debug( 'No match leave it: ' + vType + ' : ' + rType );

  }

  return cb( null );
}




// Send Email
module.exports.doMail = function( jdeJob, mailOptions, postMailCb ) {

  log.verbose( 'About to send email with these options : ' + mailOptions );
  
  // mailOptions holds mail configuration for this report from the JDE database
  // this could be as simple as a TO address as sensible defaults should be provided
  // by this program for any missing config.
  // In order to send an email the minimum required is an EMAIL = 'Y' and a TO address
  // following default values will be supplied for rest

  var email,
    from = 'noreply@dlink.com',
    to = '',
    subject = '',
    cc = '', 
    bcc = '',
    text = '',
    attachments = [],
    wrk = {},
    entry,
    mo = {};

  subject = 'Dlink JDE Report : ' + jdeJob;
  text = 'This is an automated email delivery of a report from the Dlink JDE ERP system. Please see attached report.'; 

  
  
  for ( var i = 0; i < mailOptions.length; i++ ) {

    entry = mailOptions[ i ];
    log.w( entry );

    if ( entry[ 0 ] === 'EMAIL' ) {
      email = entry[ 1 ];
    }
    if ( entry[ 0 ] === 'EMAIL_TO' ) {
      if ( to ) {
        to += ', ' + entry[ 1 ];
      } else {
        to = entry[ 1 ];
      }
    }
    if ( entry[ 0 ] === 'EMAIL_CC' ) {
      if ( cc ) {
        cc += ', ' + entry[ 1 ];
      } else {
        cc = entry[ 1 ];
      }
    }
    if ( entry[ 0 ] === 'EMAIL_BCC' ) {
      if ( bcc ) {
        bcc += ', ' + entry[ 1 ];
      } else {
        bcc = entry[ 1 ];
      }
    }
    if ( entry[ 0 ] === 'EMAIL_SUBJECT' ) {
      subject = entry[ 1 ];
    }
    if ( entry[ 0 ] === 'EMAIL_TEXT' ) {
      text = entry[ 1 ];
    }
    if ( entry[ 0 ] === 'EMAIL_FROM' ) {
      from = entry[ 1 ];
    }

  }

  wrk[ 'filename' ] = jdeJob.trim() + '.pdf';
  wrk[ 'filePath' ] = '/home/shareddata/wrkdir/' + jdeJob.trim() + '.pdf';
  attachments[ 0 ] = wrk;

  if ( ! to ) {
 
    log.error( 'No TO recipient defined - unable to send this email' );
    email = 'N';

  }

  log.d( 'EMAIL: ' + email );
  log.d( 'FROM: ' + from );
  log.d( 'TO: ' + to );
  log.d( 'SUBJECT: ' + subject );
  log.d( 'CC: ' + cc );
  log.d( 'BCC: ' + bcc );
  log.d( 'TEXT: ' + text );
  log.d( 'ATT: ' + attachments );

  mo['from'] = from;
  mo['to'] = to;
  mo['subject'] = subject;
  mo['text'] = text;
  if ( cc ) {
    mo['cc'] = from;
  }
  if ( bcc ) {
    mo['bcc'] = from;
  }
  mo['attachments'] = attachments;

  if ( email === 'Y' ) {
    smtpTransport.sendMail( mo, 
    function(err, response) {
  
      if ( err ) {
        log.error( 'Error trying to send email - failed' );
        log.error( err );
       return postMailCb( err );

      } else {

        log.verbose( "Email sent: " + response.message);
        postMailCb( null, 'SENT');
      }
    });
  } 
}


// Close Oracle Database result set
function oracleResultSetClose( connection, rs ) {

  rs.close( function( err ) {
    if ( err ) {
      log.error( 'Failed to close/cleanup DB resultset' );
      log.error( err );
      oracleDbConnectionRelease( connection );
    }
  });
}


// Close Oracle Database result set
function oracleDbConnectionRelease( connection ) {

  connection.release( function( err ) {
    if ( err ) {
      log.error( 'Failed to release/cleanup DB connection' );
      log.error( err );
      return;
    }
  });
}


function cleanup() {

  // When finished with transport object do following....
  smtpTransport.close();

}
