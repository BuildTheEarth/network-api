import Settings from "./settings.js";
import mariadb from "mariadb";

export interface Database {
  host: string;
  port: number;
  username: string;
  password: string;
  db: string;
  max_conn: number;
}

export default class DatabaseHandler {
  public databaseSettings!: Database;
  public settings: Settings;
  private pool!: mariadb.Pool;

  constructor(settings: Settings, databaseSettings: Database) {
    this.databaseSettings = databaseSettings;
    this.settings = settings;

    console.log(
      `Using Database at ${databaseSettings.host}:${databaseSettings.port}/${databaseSettings.db}`
    );

    this.pool = mariadb.createPool({
      host: databaseSettings.host,
      user: databaseSettings.username,
      password: databaseSettings.password,
      connectionLimit: databaseSettings.max_conn,
      database: databaseSettings.db,
    });
  }

  public async query(sql: string, params: any = null){
    let conn;
    try {
        // Get a connection from the pool
        conn = await this.pool.getConnection();

        // Execute the query
        let result: any = await conn.query(sql, params);

        if (this.settings.debug) 
            console.log("Query executed. (" + sql + "). Params: " + params + "");

        // Return rows and no error
        return result;
    } catch (err) {
        console.log("There was an error in the database operation. Error:");
        console.log(err);

        // Return no rows and the error
        return err ;
    } finally {
        // Release the connection back to the pool, if it was acquired
        if (conn) conn.release();
    }
}
}
