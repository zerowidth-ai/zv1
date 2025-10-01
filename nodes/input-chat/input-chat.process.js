export default async ({inputs, settings, config}) => {

  // Simply pass through the message
  // The engine will handle individual processing due to process_individually: true

  // find the text content for the most recent message
  // first get the most recent message
  
  let messageText;

  if(settings.messages.length > 0) {
    let mostRecentMessage;
    mostRecentMessage = settings.messages[settings.messages.length - 1];

    // then get the text content of the most recent message
    // content will either be a string or an array of objects where one object might have a type: "text" and a text property
    messageText = mostRecentMessage.content;
    
    if(Array.isArray(messageText)) {
      messageText = messageText.find(item => item.type === "text").text;
    }

    // if !messageText, set it to null
    if(!messageText || messageText === '') {
      messageText = null;
    }
  } else {
    mostRecentMessage = null;
  }

  // for each message, remove the participant_id and timestamp fields
  settings.messages = settings.messages.map(message => {
    delete message.id;
    delete message.participant_id;
    delete message.timestamp;
    return message;
  });


  return {
    messages: settings.messages,
    message: messageText
  };
}; 