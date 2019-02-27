import express = require('express');
import bodyParser = require('body-parser');
import router = require('./controls/GitHubController');

export class WebApi {

  /**
   * @param app - express application
   * @param port - port to listen on
   */
  constructor(private app: express.Express, private port: number) {
    this.configureMiddleware(app);
    this.configureRoutes(app);
  }

  /**
   * @param app - express application
   */
  private configureMiddleware(app: express.Express) {
    app.use(bodyParser.json());
  }

  /**
   * @param app - express application
   */
  private configureRoutes(app: express.Express) {
    app.use('/', router);
  }

  public run() {
    this.app.listen(this.port);
  }
}
