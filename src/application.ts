import express = require('express');
import bodyParser = require('body-parser');
import router = require('./routes/Router');

export class WebApi {

  /**
   * @param app - express application
   * @param port - port to listen on
   */
  constructor(private app: express.Express, private port: number) {
    this.configureRoutes(app);
  }

  /**
   * @param app - express application
   */
  private configureMiddleware(app: express.Express) {
    
  }

  /**
   * @param app - express application
   */
  private configureRoutes(app: express.Express) {
    app.use('/', router);

    // mount more routers here
    // e.g. app.use("/organisation", organisationRouter);
  }

  public run() {
    this.app.listen(this.port);
  }
}
