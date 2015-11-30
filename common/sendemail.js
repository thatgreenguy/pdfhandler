var nodemailer = require( 'nodemailer' ),
  async = require( 'async' ),
  log = require( './logger.js' ),
  smtpTransport,
  smtphost = process.env.MAIL_HOST,
  smtpport = process.env.MAIL_PORT,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


smtpTransport = nodemailer.createTransport( "SMTP", {
  host: smtphost,
  port: smtpport
});


module.exports.sendEmail = function( jdeJob, mailOptions, postMailCb ) {

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
    mo = {},
    csv = 'N';

  // Provide default values for Subject and Text (can be overridden by PDFMAIL configuration options)
  subject = 'Dlink JDE Report : ' + jdeJob;
  text = 'This is an automated email delivery of a report from the Dlink JDE ERP system. Please see attached report.'; 
  
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
      text = entry[ 1 ];
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
 
    log.w( 'No TO recipient defined - unable to send this email' );
    mailOptions.mailenabled = 'N';
    email = 'N';
    return postMailCb( null );

  }

  log.i( 'EMAIL: ' + email );
  log.i( 'FROM: ' + from );
  log.i( 'TO: ' + to );
  log.i( 'SUBJECT: ' + subject );
  log.i( 'CC: ' + cc );
  log.i( 'BCC: ' + bcc );
  log.i( 'TEXT: ' + text );
  log.i( 'ATT: ' + attachments );

  mo['from'] = from;
  mo['to'] = to;
  mo['subject'] = subject;
  mo['text'] = text;
  if ( cc ) {
    mo['cc'] = cc;
  }
  if ( bcc ) {
    mo['bcc'] = bcc;
  }
  mo['attachments'] = attachments;

  log.d( 'Mail Option check before send request...' );
  log.d( JSON.stringify( mo ) );
 

  if ( email === 'Y' ) {
    smtpTransport.sendMail( mo, 
    function(err, response) {
  
      if ( err ) {
        log.e( 'Error trying to send email - failed' );
        log.e( err );
        return postMailCb( err );

      } else {

        log.i( "Email sent: " + response.message);
        postMailCb( null, 'SENT');
      }
    });
  } 
}


function cleanup() {

  // When finished with transport object do following....
  smtpTransport.close();

}
