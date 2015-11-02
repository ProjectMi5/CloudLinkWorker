# CloudLinkWorker for Showcase Mi5

The worker is supposed to get all orders from CloudLink via REST API or MQTT and then execute these tasks on the Showcase Mi5 directly.
Therefore the worker will directly access the Recipe Tool.
He will also watch the order for completion and report back to the CloudLink via REST API.

## Installation

`npm install`

## Usage
 
`npm start`

or

`node app.js`

## Development

`npm test`
