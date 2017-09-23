/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var SearchLibrary = require('./SearchDialogLibrary');
var AzureSearch = require('./SearchProviders/azure-search');

// Azure Search
var azureSearchClient = AzureSearch.create('shushu-recipes','Id','dishrecipes');
var ResultsMapper = SearchLibrary.defaultResultsMapper(ToSearchHint)


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    stateEndpoint: process.env.BotStateEndpoint,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, [
    function(session) {
        session.send("Hi!");
        session.send("I am the Shushu Recipe Bot :)");
        session.send("I can help you find Ghanaian recipes");
        builder.Prompts.text(session, "What dish do you want the recipe for?");
    },
    function(session,results) {
        session.send(`You said ${results.response}!`);
        session.beginDialog('dishSearch');
    }
]);

bot.library(SearchLibrary.create({
    multipleSelectiion: true,
    search: function (query) { return azureSearchClient.search(query).then(ResultsMapper);},
    refiners: [],
    refineFormatter: function (refiners) {
        return _.zipObject(
            refiners.map(function (r) { return 'By' + _.capitalize(r);}),
            refiners);
    }
}));

bot.dialog('dishSearch', [
    function(session){
        // Trigger Azure Search dialogs
        SearchLibrary.begin(session);
    },
    function (session, args) {
        // Process selected search results
        session.send('Search Completed!',args.selection.map()); //format your response
    }
]);

function ToSearchHit(azureResponse) {
    return {
        // define your own parameters
        key: azureResponse.id,
        title: azureResponse.Dish,
        ingredients: azureResponse.Ingredients,
        preparation: azureResponse.Preparation,
        source: azureResponse.Source
    };
}

function searchHitAsCard(showSave, searchHit) {
    var buttons = showSave ? [new builder.CardAction().type('imBack').title('Save').value(searchHit.key)] : [];

    var card = new builder.HeroCard().title(searchHit.dish).buttons(buttons);

    if(searchHit.ingredients){
        card.subtitle(searchHit.description);
    }

    if(searchHit.preparation){
        card.text(searchHit.preparation);
    }

    return card;
}


