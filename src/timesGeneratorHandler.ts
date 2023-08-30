const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
import { S3 } from "@aws-sdk/client-s3";

export async function handler(event) {

  const s3 = new S3();
  const content = await s3.getObject({Bucket: process.env.BUCKET,
                       Key: "templates/shabbat.docx"
  });
  const binaryData = await content.Body!.transformToByteArray()
  const zip = new PizZip(binaryData);

  const doc = new Docxtemplater(zip, {
     paragraphLoop: true,
     linebreaks: true,
  }); 
  console.log(event);
  const params = event.queryStringParameters;
  console.log(params); 

  doc.render(params);
  
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
