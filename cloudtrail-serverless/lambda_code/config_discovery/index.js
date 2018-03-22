// dependencies
var AWS = require('aws-sdk');
var response = require('cfn-response');
var configservice = new AWS.ConfigService();
exports.handler = function(event, context, callback) {

    console.log('Checking if a configuration recorder exists');
    configservice.describeConfigurationRecorders(null, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED, { 'Status': 'crDNE_dcDNE' });
        } else {
            if(data.ConfigurationRecorders.length > 0) {
                // successful response",
                var configurationRecorders = data;
                console.log('Found Configuration Recoder: ' + configurationRecorders.ConfigurationRecorders[0].name);
                console.log('Checking for the existence of a Delivery Channel');

                configservice.describeDeliveryChannels(null, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                        response.send(event, context, response.FAILED, { 'Status': 'crE_dcDNE' });
                    } else {
                        if(data.DeliveryChannels.length > 0){
                            console.log('There is an existing delivery channel, checking if it has an s3 bucket');
                            deliveryChannels = data;
                            deliveryChannel = deliveryChannels.DeliveryChannels[0];
                            // ISSUE IS HERE DELIVERY CHANNEL IS NOT PROPERLY SET UP deliveryChannels: [{}]
                            console.log(deliveryChannels);
                            console.log(deliveryChannel);
                            if (deliveryChannel.s3BucketName) {
                                console.log('S3 Bucket delivery channel found. Returning it to the template.');
                                if (deliveryChannel.s3KeyPrefix) {
                                    console.log('Bucket has a prefix. Full bucket name: ' + deliveryChannel.s3BucketName + '\\' + deliveryChannel.s3KeyPrefix);
                                    response.send(event, context, response.SUCCESS, {
                                        'Status': 'crE_dcE',
                                        'ConfigurationRecorder': configurationRecorders.ConfigurationRecorders[0].name,
                                        'FinalS3BucketConfig': deliveryChannel.s3BucketName + '\\' + deliveryChannel.s3KeyPrefix,
                                        'FinalS3BucketConfigArn': "arn:aws:s3:::" + deliveryChannel.s3BucketName + '\\' + deliveryChannel.s3KeyPrefix
                                    });
                                } else {
                                    console.log('Bucket does not have a prefix. Full bucket name: ' + deliveryChannel.s3BucketName);
                                    response.send(event, context, response.SUCCESS, {
                                        'Status': 'crE_dcE',
                                        'ConfigurationRecorder': configurationRecorders.ConfigurationRecorders[0].name,
                                        'FinalS3BucketConfig': deliveryChannel.s3BucketName,
                                        'FinalS3BucketConfigArn': "arn:aws:s3:::" + deliveryChannel.s3BucketName
                                    });
                                }
                            } else {
                                console.log('Recorder exists but delivery channel is only SNS. Attach s3 Bucket to delivery channel configuration.');
                                var dcParams = {
                                    DeliveryChannel: {
                                        name: "CFN_delivery_channel",
                                        configSnapshotDeliveryProperties: {
                                            deliveryFrequency: "One_Hour"
                                        },
                                        s3BucketName: event.ResourceProperties.S3BucketConfig
                                    }
                                };
                                console.log("Creating delivery channel");
                                configservice.putDeliveryChannel(dcParams, function(err, data) {
                                    if (err) {
                                        console.log(err, err.stack);
                                        response.send(event, context, response.FAILED, {
                                            'Status': 'crE_dcDNE'
                                        });
                                    } else {
                                        console.log(data);
                                        response.send(event, context, response.SUCCESS, {
                                            'Status': 'crE_dcDNE',
                                            'FinalS3BucketConfig': event.ResourceProperties.S3BucketConfig ,
                                            'FinalS3BucketConfigArn': event.ResourceProperties.S3BucketConfigArn
                                        });
                                    }
                                });
                                response.send(event, context, response.SUCCESS, {
                                    'Status': 'crE_dcE',
                                    'FinalS3BucketConfig': event.ResourceProperties.S3BucketConfig ,
                                    'FinalS3BucketConfigArn': event.ResourceProperties.S3BucketConfigArn
                                });
                            }
                        } else {
                            console.log('Recorder exists but no delivery channel. Deleting old recorder and creating a new recorder and a new delivery channel.');
                            console.log('Deleting the recorder');

                            var params = {
                              ConfigurationRecorderName: configurationRecorders.ConfigurationRecorders[0].name
                            };
                            configservice.deleteConfigurationRecorder(params, function(err, data) {
                              if (err) {
                                  console.log(err, err.stack);
                                  response.send(event, context, response.FAILED, {
                                      'Status': 'crE_dcDNE'
                                  });
                              } else {
                                  console.log(data);
                                  var crParams = {
                                      ConfigurationRecorder: {
                                          name: event.ResourceProperties.ConfigRecorderName,
                                          recordingGroup: {
                                              allSupported: true,
                                              includeGlobalResourceTypes: true
                                          },
                                          roleARN: event.ResourceProperties.RecorderRoleArn
                                      }
                                  };
                                  console.log('Creating new configuration recorder');
                                  configservice.putConfigurationRecorder(crParams, function(err, data) {
                                      if (err) {
                                          console.log(err, err.stack);
                                          response.send(event, context, response.FAILED, {
                                              'Status': 'crE_dcDNE'
                                          });
                                      } else {
                                          console.log(data);
                                          console.log('Adding the delivery channel');
                                          var dcParams = {
                                              DeliveryChannel: {
                                                  name: "CFN_delivery_channel",
                                                  configSnapshotDeliveryProperties: {
                                                      deliveryFrequency: "One_Hour"
                                                  },
                                                  s3BucketName: event.ResourceProperties.S3BucketConfig
                                              }
                                          };
                                          console.log("Creating delivery channel");
                                          configservice.putDeliveryChannel(dcParams, function(err, data) {
                                              if (err) {
                                                  console.log(err, err.stack);
                                                  response.send(event, context, response.FAILED, {
                                                      'Status': 'crE_dcDNE'
                                                  });
                                              } else {
                                                  console.log(data);
                                                  response.send(event, context, response.SUCCESS, {
                                                      'Status': 'crE_dcDNE',
                                                      'FinalS3BucketConfig': event.ResourceProperties.S3BucketConfig ,
                                                      'FinalS3BucketConfigArn': event.ResourceProperties.S3BucketConfigArn
                                                  });
                                              }
                                          });
                                      }
                                  });
                              }
                            });
                        }
                    }
                })

            } else {
                console.log('No configuration recorded exists');

                configservice.describeDeliveryChannels(null, function(err, data) {
                  if (err) {
                      console.log(err, err.stack);
                  } else {
                      console.log(data);
                      if (data.DeliveryChannels.length > 0) {
                          console.log('Old delivery channel exists. Deleting and creating new configuration recorder and delivery channel');
                          var params = {
                              DeliveryChannelName: data.DeliveryChannels[0].name
                          };
                          configservice.deleteDeliveryChannel(params, function(err, data) {
                              if (err) {
                                  console.log(err, err.stack);
                                  response.send(event, context, response.FAILED, {
                                      'Status': 'crDNE_dcDNE'
                                  });
                              } else {
                                  console.log(data);
                                   var crParams = {
                                      ConfigurationRecorder: {
                                          name: event.ResourceProperties.ConfigRecorderName,
                                          recordingGroup: {
                                              allSupported: true,
                                              includeGlobalResourceTypes: true
                                          },
                                          roleARN: event.ResourceProperties.RecorderRoleArn
                                      }
                                   };
                                   configservice.putConfigurationRecorder(crParams, function(err, data) {
                                      if (err) {
                                          console.log(err, err.stack);
                                          response.send(event, context, response.FAILED, {
                                              'Status': 'crDNE_dcDNE'
                                          });
                                      } else {
                                          console.log(data);
                                          var dcParams = {
                                              DeliveryChannel: {
                                                  name: "CFN_delivery_channel",
                                                  configSnapshotDeliveryProperties: {
                                                      deliveryFrequency: "One_Hour"
                                                  },
                                                  s3BucketName: event.ResourceProperties.S3BucketConfig
                                              }
                                          };
                                          configservice.putDeliveryChannel(dcParams, function(err, data) {
                                              if (err) {
                                                  console.log(err, err.stack);
                                                  response.send(event, context, response.FAILED, {
                                                      'Status': 'crDNE_dcDNE'
                                                  });
                                              } else {
                                                  console.log(data);
                                                  response.send(event, context, response.SUCCESS, {
                                                      'Status': 'crDNE_dcDNE',
                                                      'FinalS3BucketConfig': event.ResourceProperties.S3BucketConfig ,
                                                      'FinalS3BucketConfigArn': event.ResourceProperties.S3BucketConfigArn
                                                  });
                                              }
                                          });
                                      }
                                   });
                              }
                          });
                      } else {
                          console.log('No old delivery channel. Creating new configuration recorder and delivery channel');
                          var crParams = {
                              ConfigurationRecorder: {
                                  name: event.ResourceProperties.ConfigRecorderName,
                                  recordingGroup: {
                                      allSupported: true,
                                      includeGlobalResourceTypes: true
                                  },
                                  roleARN: event.ResourceProperties.RecorderRoleArn
                              }
                          };
                          configservice.putConfigurationRecorder(crParams, function(err, data) {
                              if (err) {
                                  console.log(err, err.stack);
                                  response.send(event, context, response.FAILED, {
                                      'Status': 'crDNE_dcDNE'
                                  });
                              } else {
                                  console.log(data);
                                  var dcParams = {
                                      DeliveryChannel: {
                                          name: "CFN_delivery_channel",
                                          configSnapshotDeliveryProperties: {
                                              deliveryFrequency: "One_Hour"
                                          },
                                          s3BucketName: event.ResourceProperties.S3BucketConfig
                                      }
                                  };
                                  configservice.putDeliveryChannel(dcParams, function(err, data) {
                                      if (err) {
                                          console.log(err, err.stack);
                                          response.send(event, context, response.FAILED, {
                                              'Status': 'crDNE_dcDNE'
                                          });
                                      } else {
                                          console.log(data);
                                          response.send(event, context, response.SUCCESS, {
                                              'Status': 'crDNE_dcDNE',
                                              'FinalS3BucketConfig': event.ResourceProperties.S3BucketConfig ,
                                              'FinalS3BucketConfigArn': event.ResourceProperties.S3BucketConfigArn
                                          });
                                      }
                                  });
                              }
                          });
                      }
                  }
                });
            }
        }
    });
};