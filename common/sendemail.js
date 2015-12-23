var nodemailer = require( 'nodemailer' ),
  async = require( 'async' ),
  log = require( './logger.js' ),
  smtpTransport,
  smtphost = process.env.MAIL_HOST,
  smtpport = process.env.MAIL_PORT,
  jdeEnv = process.env.JDE_ENV,
  jdeMailEnv = process.env.JDE_MAIL_ENV,
  jdeMailSub = process.env.JDE_MAIL_SUB,
  jdeMailTxt = process.env.JDE_MAIL_TXT,
  jdeEnvDb = process.env.JDE_ENV_DB;


smtpTransport = nodemailer.createTransport( "SMTP", {
  host: smtphost,
  port: smtpport
});



// mailOptions holds mail configuration for this report from the JDE database
// this could be as simple as a TO address as sensible defaults should be provided
// by this program for any missing config.
// In order to send an email the minimum required is an EMAIL = 'Y' and a TO address
// following default values will be supplied for rest
//
module.exports.sendEmail = function( pargs, postMailCb ) {

  var email,
    from = 'noreply@dlink.eu',
    to = '',
    subject = '',
    cc = '', 
    bcc = '',
    text = '',
    attachments = [],
    wrk = {},
    entry,
    mo = {},
    csv = 'N',
    textCount = 0;

  jdeJob = pargs.newPdf;
  mailOptions = pargs.mailOptionsArray;

  // DEFAULT MAIL ENVIRONMENT
  //
  // If JDE Mail From Environment indicator not provided e.g. PY/UAT or PD then use the provided JDE_ENV value as fallback (usually DV812, PY812 etc)
  if ( typeof( jdeMailEnv ) === 'undefined' ) {
    jdeMailEnv = jdeEnv + ' ';
  } 

  // If JDE Mail Environment indicator is just spaces then set it to empty string
  if ( jdeMailEnv.trim() === 0 ) {
    jdeMailEnv = '';
  }


  // DEFAULT MAIL SUBJECT
  //
  // Provide default Subject Text use environment variable or hard coded fallback value if not set
  // Subject will be prepended by JDE Environment (DV, PY or PD) and suffixed with JDE PDF Job Name
  // Subject can of course be overridden in mail config at Report and/or Version level  
  if ( typeof( jdeMailSub ) !== 'undefined' ) {
    subject = jdeMailSub;
  } else {
    subject = 'Dlink JDE Report'; 
  }

  // Default Subject is JDE environment indicator + subject text + PDF Job Details  
  // Remember this is a default - if a value is provided at Report and/or Version level then that value will be used instead
  subject = jdeMailEnv + subject + ' ' + jdeJob;


  // DEFAULT TEXT
  //  
  // Provide Default Text - use passed environment variable or if not available fallback to hard coded text here
  // Remember this is a default - if a value is provided at Report and/or Version level then that value will be used instead  
  if ( typeof( jdeMailTxt ) === 'undefined' ) {
    text = 'This is an automated email delivery of a report from the Dlink JDE ERP system. Please see attached report.'; 
  } else {
    text = jdeMailTxt;
  }

  log.v( pargs.newPdf + ' DEFAULT SUBJECT: ' + subject );
  log.v( pargs.newPdf + ' DEFAULT TEXT:    ' + text );

  // CONFIGURED MAIL OPTIONS
  //
  // Default values will be overridden by any mail options configured at Report and/or Version level
  // Build up all mailing options for this JDE PDF Job/Report
  for ( var i = 0; i < mailOptions.length; i++ ) {

    entry = mailOptions[ i ];
    log.v( entry );

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

      if ( textCount == 0 ) {

        text = entry[ 1 ];

      } else {

        text += entry[ 1 ]; 

      }
      textCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_FROM' ) {
      from = entry[ 1 ];
    }
    if ( entry[ 0 ] === 'EMAIL_CSV' ) {
      csv = entry[ 1 ];
    }

  }


  // Could be sending .pdf or .csv
  if ( csv !== 'Y' ) {
    wrk[ 'filename' ] = jdeJob.trim() + '.pdf';
    wrk[ 'filePath' ] = '/home/shareddata/wrkdir/' + jdeJob.trim() + '.pdf';
  } else {
    wrk[ 'filename' ] = jdeJob.trim() + '.csv';
    wrk[ 'filePath' ] = '/home/shareddata/wrkdir/' + jdeJob.trim() + '.csv';
  }

  attachments[ 0 ] = wrk;

  if ( ! to ) {
 
    log.w( pargs.newPdf + ' No TO recipient defined - unable to send this email' );
    mailOptions.mailenabled = 'N';
    email = 'N';
    return postMailCb( null );

  }

  log.i( pargs.newPdf + ' EMAIL: ' + email );
  log.i( pargs.newPdf + ' FROM: ' + from );
  log.i( pargs.newPdf + ' TO: ' + to );
  log.i( pargs.newPdf + ' SUBJECT: ' + subject );
  log.i( pargs.newPdf + ' CC: ' + cc );
  log.i( pargs.newPdf + ' BCC: ' + bcc );
  log.i( pargs.newPdf + ' TEXT: ' + text );
  log.i( pargs.newPdf + ' ATT: ' + attachments );

  mo['from'] = from;
  mo['to'] = to;
  mo['subject'] = subject;

  //  mo['text'] = text;
  mo['html'] = text;
  if ( cc ) {
    mo['cc'] = cc;
  }
  if ( bcc ) {
    mo['bcc'] = bcc;
  }
  mo['attachments'] = attachments;

  log.v( JSON.stringify( mo ) );


  if ( email === 'Y' ) {
    smtpTransport.sendMail( mo, 
    function(err, response) {
  
      if ( err ) {
        response = 'EMAIL Send FAILED : ' + err
        log.e( response );
        return postMailCb( err, response );

      } else {
        response = 'EMAIL Sent OK : ' + JSON.stringify( response );
        log.i( response );
        postMailCb( null, response);
      }
    });
  } 
}


function cleanup() {

  // When finished with transport object do following....
  smtpTransport.close();

}
