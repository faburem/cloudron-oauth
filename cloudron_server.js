'use strict';

/**
 * Define the base object namespace. By convention we use the service name
 * in PascalCase (aka UpperCamelCase). Note that this is defined as a package global.
 */
Cloudron = {};
if (process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET) {
  ServiceConfiguration.configurations.update(
    { service: 'cloudron' },
    { $set:
       {
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET
       }
     },
   { upsert: true }
);
}
Meteor.settings.public.API_ORIGIN = process.env.API_ORIGIN
Meteor.settings.public.OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID
/**
 * Boilerplate hook for use by underlying Meteor code
 */
Cloudron.retrieveCredential = (credentialToken, credentialSecret) => {
  return OAuth.retrieveCredential(credentialToken, credentialSecret);
};


Cloudron.whitelistedFields = ['id', 'email', 'alternateEmail', 'username', 'displayName'];

/**
 * Register this service with the underlying OAuth handler
 * (name, oauthVersion, urls, handleOauthRequest):
 *  name = 'cloudron'
 *  oauthVersion = 2
 *  urls = null for OAuth 2
 *  handleOauthRequest = function(query) returns {serviceData, options} where options is optional
 * serviceData will end up in the user's services.cloudron
 */
OAuth.registerService('cloudron', 2, null, function(query) {

  /**
   * Make sure we have a config object for subsequent use (boilerplate)
   */
  const config = ServiceConfiguration.configurations.findOne({
    service: 'cloudron'
  });
  if (!config) {
    throw new ServiceConfiguration.ConfigError();
  }
  /**
   * Get the token and username (Meteor handles the underlying authorization flow).
   */
  const response = getTokens(config, query);
  const accessToken = response.accessToken;
  // const username = response.username;

  /**
   * If we got here, we can now request data from the account endpoints
   * to complete our serviceData request.
   * The identity object will contain the username plus *all* properties
   * retrieved from the account and settings methods.
  */
  // const identity = _.extend(
    // {username},
  const identity = getAccount(config, accessToken);
    // getSettings(config, username, accessToken)
  // );

  /**
   * Build our serviceData object. This needs to contain
   *  accessToken
   *  expiresAt, as a ms epochtime
   *  refreshToken, if there is one
   *  id - note that there *must* be an id property for Meteor to work with
   *  email
   *  reputation
   *  created
   * We'll put the username into the user's profile
   */
  const serviceData = {
    accessToken,
    expiresAt: (+new Date) + (6048*100000)
  };
  if (response.refreshToken) {
    serviceData.refreshToken = response.refreshToken;
  }
  _.extend(serviceData, _.pick(identity, Cloudron.whitelistedFields));

  /**
   * Return the serviceData object along with an options object containing
   * the initial profile object with the username.
   */
  return {
    serviceData: serviceData,
    options: {
      profile: {
        name: identity.displayName,
        username: identity.username,
      }
    }
  };
});

/**
 * The following three utility functions are called in the above code to get
 *  the access_token
 *  account data (getAccount)
 * repectively.
 */

/** getTokens exchanges a code for a token
 *
 *  returns an object containing:
 *   accessToken        {String}
 *
 * @param   {Object} config       The OAuth configuration object
 * @param   {Object} query        The OAuth query object
 * @return  {Object}              The response from the token request (see above)
 */
const getTokens = function(config, query) {

  const endpoint = process.env.API_ORIGIN + '/api/v1/oauth/token';

  /**
   * Attempt the exchange of code for token
   */
  let response;
  try {
    response = HTTP.post(
      endpoint, {
        params: {
          code: query.code,
          client_id: process.env.OAUTH_CLIENT_ID,
          client_secret: process.env.OAUTH_CLIENT_SECRET,
          grant_type: 'authorization_code'
        }
      });

  } catch (err) {
    throw _.extend(new Error(`Failed to complete OAuth handshake with Cloudron. ${err.message}`), {
      response: err.response
    });
  }
  if (response.data.error) {

    /**
     * The http response was a json object with an error attribute
     */
    throw new Error(`Failed to complete OAuth handshake with Cloudron. ${response.data.error}`);

  } else {

    /** The exchange worked. We have an object containing
     *   access_token
     *
     * Return an appropriately constructed object
     */
    return {
      accessToken: response.data.access_token,
    };
  }
};

/**
 * getAccount gets the basic Cloudron account data
 *
 *  returns an object containing:
 *   id             {Integer}         The user's Cloudron id
 *   url            {String}          The account username as requested in the URI
 *   bio            {String}          A basic description the user has filled out
 *   reputation     {Float}           The reputation for the account.
 *   created        {Integer}         The epoch time of account creation
 *   pro_expiration {Integer/Boolean} False if not a pro user, their expiration date if they are.
 *
 * @param   {Object} config       The OAuth configuration object
 * @param   {String} accessToken  The OAuth access token
 * @return  {Object}              The response from the account request (see above)
 */
const getAccount = function(config, accessToken) {

  const endpoint = `${process.env.API_ORIGIN}/api/v1/profile`;
  let accountObject;

  try {
    accountObject = HTTP.get(
      endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).data;
    return accountObject;

  } catch (err) {
    throw _.extend(new Error(`Failed to fetch account data from Cloudron. ${err.message}`), {
      response: err.response
    });
  }
};
