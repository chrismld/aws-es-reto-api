'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
var crypto = require('crypto');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

function isEmpty(obj) {
  return !Object.keys(obj).length;
}

function jsonMessage(code, msg){
    return {
            statusCode: code,
            body: JSON.stringify(msg),
        };
}

module.exports.crear = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  if (typeof data.email !== 'string') {
    console.error('Correo invalido');
    callback(null, jsonMessage(500, { err: 'No se pudo crear el perfil, se debe incluir un email.' }));
    return;
  }

  if (typeof data.certtype !== 'string') {
    console.error('Certificacion invalida');
    callback(null, jsonMessage(500, { err: 'No se pudo crear el perfil, se debe incluir una certificacion.' }));
    return;
  }

  if (typeof data.certphoto !== 'string') {
    console.error('Foto certificacion invalida');
    callback(null, jsonMessage(500, { err: 'No se pudo crear el perfil, se debe ingresar la foto de la certificacion.' }));
    return;
  }

  var hashKey = crypto.createHash('md5').update(data.email + data.certtype).digest("hex");
  const validate = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      emailcert: hashKey,
    },
  };

  // fetch todo from the database
  dynamoDb.get(validate, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      callback(null, jsonMessage(500, { err: 'No se pudo validar si ya existe el perfil.' }));
      return;
    }

    console.log(result);
    if (!isEmpty(result)){
        var existe = "Ya existe el perfil: " + data.email + " | " + data.certtype;
        console.error(existe);
        callback(null, jsonMessage(400, { err: existe }));
        return;
    }

    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Item: {
            id: uuid.v1(),
            email: data.email,
            emailcert: hashKey,
            certtype: data.certtype,
            certphoto: data.certphoto,
            fullname: data.fullname,
            country: data.country,
            createdAt: timestamp,
            updatedAt: timestamp,
        },
    };

    // write the todo to the database
    dynamoDb.put(params, (error) => {
        // handle potential errors
        if (error) {
            console.error(error);
            callback(null, jsonMessage(500, { err: 'No se pudo crear el perfil.' }));
            return;
        }

        var responseBody = JSON.stringify(params.Item);
        
        var sns = new AWS.SNS();
        sns.publish({
          Message: responseBody,
          TopicArn: process.env.SNS_TOPIC
        }, function(err, data) {
          if (err) {
            console.log(err.stack);
          }

          const response = {
              statusCode: 200,
              body: responseBody,
          };
          callback(null, response);
        });

        // create a response
        
    });
  });  
};