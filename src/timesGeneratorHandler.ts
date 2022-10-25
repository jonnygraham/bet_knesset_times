const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const AWS = require("aws-sdk");

exports.handler = async (event) => {

  const S3 = new AWS.S3();
  const content = await S3.getObject({Bucket: process.env.BUCKET,
			Key: 'templates/shabbat.docx'}).promise();
    
  const zip = new PizZip(content.Body);
  const doc = new Docxtemplater(zip, {
     paragraphLoop: true,
     linebreaks: true,
  }); 
  console.log(event);
  const params = event.queryStringParameters;
  console.log(params); 

  doc.render(params);
  //doc.render({erev_mincha:params.erev_mincha,day_shacharit:'08:00',day_mincha_gedola:'12:45',day_mincha_ketana:'17:10'});
  
  const buf = doc.getZip().generate({
     type: "nodebuffer",
     compression: "DEFLATE",
  });

        var response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': "*",
                'Access-Control-Allow-Methods': 'GET, POST',
                'Content-type' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': 'inline; filename="shabbat_times.docx"'
            },
            isBase64Encoded: true,
            body: buf.toString('base64'),
        };
  return response;
}
