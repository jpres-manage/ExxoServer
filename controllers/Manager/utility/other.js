
exports.MakeSimpleEmail = (email ) =>{

    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email; // Returns the original if no '@' found

    const localPart = email.substring(0, atIndex);
    const domainPart = email.substring(atIndex);

    // Get the first 5 characters of the local part, if it's less than 5, take as many as available
    const visiblePart = localPart.length > 5 ? localPart.substring(0, 5) : localPart;

    // Create the masked part
    const maskedEmail = `${visiblePart}***${domainPart}`;
    return maskedEmail;

}