# Extend the Default MindsDB Configuration

To follow this guide, install MindsDB locally via [Docker](/setup/self-hosted/docker-desktop) or [PyPI](/setup/self-hosted/pip/source).

## Starting MindsDB with Extended Configuration

Start MindsDB locally with your custom configuration by providing a path to the `config.json` file that stores custom config parameters listed in this section.

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_CONFIG_PATH=/Users/username/path/config.json -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Python
  python -m mindsdb --api=http,mysql --config=/path-to-the-extended-config-file/config.json
  ```
</CodeGroup>

### Available Config Parameters

Below are all of the custom configuration parameters that should be set according to your requirements and saved into the `config.json` file.

#### `permanent_storage`

```bash
{
    "permanent_storage": {
        "location": "absent",
        "bucket": "s3_bucket_name" # optional, used only if "location": "s3"
    },
```

The `permanent_storage` parameter defines where MindsDB stores copies of user files, such as uploaded files, models, and tab content. MindsDB checks the `permanent_storage` location to access the latest version of a file and updates it as needed.

The `location` specifies the storage type.

* `absent` (default): Disables permanent storage and is recommended to use when MindsDB is running locally.
* `local`: Stores files in a local directory defined with `config['paths']['storage']`.
* `s3`: Stores files in an Amazon S3 bucket. This option requires the `bucket` parameter that specifies the name of the S3 bucket where files will be stored.

If this parameter is not set, the path is determined by the `MINDSDB_STORAGE_DIR` environment variable. MindsDB defaults to creating a `mindsdb` folder in the operating system user's home directory.

#### `paths`

```bash
    "paths": {
        "root": "/home/mindsdb/var", # optional (alternatively, it can be defined in the MINDSDB_STORAGE_DIR environment variable)
        "content": "/home/mindsdb/var/content", # optional
        "storage": "/home/mindsdb/var/storage", # optional
        "static": "/home/mindsdb/var/static", # optional
        "tmp": "/home/mindsdb/var/tmp", # optional
        "cache": "/home/mindsdb/var/cache", # optional
        "locks": "/home/mindsdb/var/locks", # optional
    },
```

The `paths` parameter allows users to redefine the file paths for various groups of MindsDB files. If only the `root` path is defined, all other folders will be created within that directory. If this parameter is absent, the value is determined by the `MINDSDB_STORAGE_DIR` environment variable.

The `root` parameter defines the base directory for storing all MindsDB files, including models, uploaded files, tab content, and the internal SQLite database (if running locally).

The `content` parameter specifies the directory where user-related files are stored, such as uploaded files, created models, and tab content. The internal SQLite database (if running locally) is stored in the `root` directory instead.

If the `['permanent_storage']['location']` is set to `'local'`, then the `storage` parameter is used to store copies of user files.

The `static` parameter is used to store files for the graphical user interface (GUI) when MindsDB is run locally.

The `tmp` parameter designates a directory for temporary files. Note that the operating system’s default temporary directory may also be used for some temporary files.

If the `['cache']['type']` is set to `'local'`, then the `cache` parameter defines the location for storing cached files for the most recent predictions. For example, if a model is queried with identical input, the result will be stored in the cache and returned directly on subsequent queries, instead of recalculating the prediction.

The `locks` parameter is used to store lock files to prevent race conditions when the `content` folder is shared among multiple applications. This directory helps ensure that file access is managed properly using `fcntl` locks. Note that this is not applicable for Windows OS.

#### `auth`

```bash
    "auth":{
        "http_auth_enabled": true,
        "username": "username",
        "password": "password"
    },
```

The `auth` parameter controls the authentication settings for APIs in MindsDB.

If the `http_auth_enabled` parameter is set to `true`, then the `username` and `password` parameters are required. Otherwise these are optional.

In local instances of MindsDB, users can enable simple HTTP authentication based on bearer tokens, as follows:

1. Enable the authentication for the HTTP API by setting the `http_auth_enabled` parameter to `true` and providing values for the `username` and `password` parameters. Alternatively, users can set the environment variables - `MINDSDB_USERNAME` and `MINDSDB_PASSWORD` - to store these values..

2. Bearer tokens are valid indefinitely.

#### `gui`

```bash
    "gui": {
        "autoupdate": true,
        "open_on_start": true
    },
```

The `gui` parameter controls the behavior of the MindsDB graphical user interface (GUI) updates.

The `autoupdate` parameter defines whether MindsDB automatically checks for and updates the GUI to the latest version when the application starts. If set to `true`, MindsDB will attempt to fetch the latest available version of the GUI. If set to `False`, MindsDB will not try to update the GUI on startup.

The `open_on_start` parameter defines whether MindsDB automatically opens the GUI on start. If set to `true`, MindsDB will open the GUI automatically. If set to `False`, MindsDB will not open the GUI on startup.

#### `api`

```bash
    "api": {
        "http": {
            "host": "127.0.0.1",
            "port": "47334",
            "restart_on_failure": true,
            "max_restart_count": 1,
            "max_restart_interval_seconds": 60,
            "a2wsgi": {
                "workers": 15,
                "send_queue_size": 10
            }
        },
        "mysql": {
            "host": "127.0.0.1",
            "port": "47335",
            "database": "mindsdb",
            "ssl": true,
            "restart_on_failure": true,
            "max_restart_count": 1,
            "max_restart_interval_seconds": 60
        },
    },
```

The `api` parameter contains the configuration settings for running MindsDB APIs.

Currently, the supported APIs are:

* `http`: Configures the HTTP API. It requires the `host` and `port` parameters. Alternatively, configure HTTP authentication for your MindsDB instance by setting the environment variables `MINDSDB_USERNAME` and `MINDSDB_PASSWORD` before starting MindsDB, which is a recommended way for the production systems.
* `mysql`: Configures the MySQL API. It requires the `host` and `port` parameters and additionally the `database` and `ssl` parameters.

<AccordionGroup>
  <Accordion title="HTTP API">
    Connection parameters for the HTTP API include:

    * `host`: Specifies the IP address or hostname where the API should run. For example, `"127.0.0.1"` indicates the API will run locally.

    * `port`: Defines the port number on which the API will listen for incoming requests. The default ports are `47334` for HTTP, and `47335` for MySQL.

    * `restart_on_failure`: If it is set to `true` (and `max_restart_count` is not reached), the restart of MindsDB will be attempted after the MindsDB process was killed - with code 9 on Linux and MacOS, or for any reason on Windows.

    * `max_restart_count`: This defines how many times the restart attempts can be made. Note that 0 stands for no limit.

    * `max_restart_interval_seconds`: This defines the time limit during which there can be no more than `max_restart_count` restart attempts. Note that 0 stands for no time limit, which means there would be a maximum of `max_restart_count` restart attempts allowed.

      <Note>
        Here is a usage example of the restart features:

        Assume the following values:

        * max\_restart\_count = 2
        * max\_restart\_interval\_seconds = 30 seconds

        Assume the following scenario:

        * MindsDB fails at 1000s of its work - the restart attempt succeeds as there were no restarts in the past 30 seconds.
        * MindsDB fails at 1010s of its work - the restart attempt succeeds as there was only 1 restart (at 1000s) in the past 30 seconds.
        * MindsDB fails at 1020s of its work - the restart attempt fails as there were already max\_restart\_count=2 restarts (at 1000s and 1010s) in the past 30 seconds.
        * MindsDB fails at 1031s of its work - the restart attempt succeeds as there was only 1 restart (at 1010s) in the past 30 seconds.
      </Note>

    * `a2wsgi` is an WSGI wrapper with the following parameters: `workers` defines the number of requests that can be processed in parallel, and `send_queue_size` defines the buffer size.
  </Accordion>

  <Accordion title="MySQL API">
    Connection parameters for the MySQL API include:

    * `host`: Specifies the IP address or hostname where the API should run. For example, `"127.0.0.1"` indicates the API will run locally.
    * `port`: Defines the port number on which the API will listen for incoming requests. The default ports are `47334` for HTTP, and `47335` for MySQL.
    * `database`: Specifies the name of the database that MindsDB uses. Users must connect to this database to interact with MindsDB through the respective API.
    * `ssl`: Indicates whether SSL support is enabled for the MySQL API.
    * `restart_on_failure`: If it is set to `true` (and `max_restart_count` is not reached), the restart of MindsDB will be attempted after the MindsDB process was killed - with code 9 on Linux and MacOS, or for any reason on Windows.
    * `max_restart_count`: This defines how many times the restart attempts can be made. Note that 0 stands for no limit.
    * `max_restart_interval_seconds`: This defines the time limit during which there can be no more than `max_restart_count` restart attempts. Note that 0 stands for no time limit, which means there would be a maximum of `max_restart_count` restart attempts allowed.
  </Accordion>
</AccordionGroup>

#### `cache`

```bash
    "cache": {
        "type": "local",
        "connection": "redis://localhost:6379" # optional, used only if "type": "redis"
    },
```

The `cache` parameter controls how MindsDB stores the results of recent predictions to avoid recalculating them if the same query is run again. Note that recent predictions are cached for ML models, like Lightwood, but not in the case of large language models (LLMs), like OpenAI.

The `type` parameter specifies the type of caching mechanism to use for storing prediction results.

* `none`: Disables caching. No prediction results are stored.
* `local` (default): Stores prediction results in the `cache` folder (as defined in the `paths` configuration). This is useful for repeated queries where the result doesn't change.
* `redis`: Stores prediction results in a Redis instance. This option requires the `connection` parameter, which specifies the Redis connection string.

The `connection` parameter is required only if the `type` parameter is set to `redis`. It stores the Redis connection string.

#### `logging`

```bash
    "logging": {
        "handlers": {
            "console": {
                "enabled": true,
                "formatter": "default", # optional, available values include default and json
                "level": "INFO" # optional (alternatively, it can be defined in the MINDSDB_CONSOLE_LOG_LEVEL environment variable)
            },
            "file": {
                "enabled": False,
                "level": "INFO", # optional (alternatively, it can be defined in the MINDSDB_FILE_LOG_LEVEL environment variable)
                "filename": "app.log",
                "maxBytes": 524288, # 0.5 Mb
                "backupCount": 3
            }
        }
    },
```

The above parameters are implemented based on [Python's Logging Dictionary Schema](https://docs.python.org/3/library/logging.config.html#logging-config-dictschema).

The `logging` parameter defines the details of output logging, including the logging levels.

The `handler` parameter provides handlers used for logging into streams and files.

* `console`: This parameter defines the setup for saving logs into a stream.

  * If the `enabled` parameter is set to `true`, then the logging output is saved into a stream.
  * Users can define the `formatter` parameter that configures the format of the logs, where the available values include `default` and `json`.
  * Users can also define the logging level in the `level` parameter or in the `MINDSDB_CONSOLE_LOG_LEVEL` environment variable - one of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.

* `file`: This parameter defines the setup for saving logs into a file.

  * If the `enabled` parameter is set to `true`, then the logging output is saved into a file.
  * Users can define the logging level in the `level` parameter or in the `MINDSDB_FILE_LOG_LEVEL` environment variable - one of `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.
  * Additionally, the `filename` parameter stores the name of the file that contains logs.
  * And the `maxBytes` and `backupCount` parameters determine the rollover process of the file - that is, if the file reached the size of `maxBytes`, then the file is closed and a new file is opened, where the number of files is defined by the `backupCount` parameter.

#### `ml_task_queue`

```bash
    "ml_task_queue": {
        "type": "local",
        "host": "localhost", # optional, used only if "type": "redis"
        "port": 6379, # optional, used only if "type": "redis"
        "db": 0, # optional, used only if "type": "redis"
        "username": "username", # optional, used only if "type": "redis"
        "password": "password" # optional, used only if "type": "redis"
    },
```

The `ml_task_queue` parameter manages the queueing system for machine learning tasks in MindsDB. ML tasks include operations such as creating, training, predicting, fine-tuning, and retraining models. These tasks can be resource-intensive, and running multiple ML tasks simultaneously may lead to Out of Memory (OOM) errors or performance degradation. To address this, MindsDB uses a task queue to control task execution and optimize resource utilization.

The `type` parameter defines the type of task queue to use.

* `local`: Tasks are processed immediately as they appear, without a queue. This is suitable for environments where resource constraints are not a concern.
* `redis`: Tasks are added to a Redis-based queue, and consumer process (which is run with `--ml_task_consumer`) ensures that tasks are executed only when sufficient resources are available.
  * Using a Redis queue requires additional configuration such as the `host`, `port`, `db`, `username`, and `password` parameters.
  * To use the Redis queue, start MindsDB with the following command to initiate a queue consumer process: `python3 -m mindsdb --ml_task_queue_consumer`. This process will monitor the queue and fetch tasks for execution only when sufficient resources are available.

#### `url_file_upload`

```bash
   "url_file_upload": {
           "enabled": true,
           "allowed_origins": ["https://example.com"],
           "disallowed_origins": ["http://example.com"]
    }
```

The `url_file_upload` parameter restricts file uploads to trusted sources by specifying a list of allowed domains. This ensures that users can only upload files from the defined sources, such as S3 or Google Drive.

The `enabled` flag turns this feature on (`true`) or off (`false`).

The `allowed_origins` parameter lists allowed domains. If left empty, then any domain is allowed.

The `disallowed_origins` parameter lists domains that are not allowed. If left empty, then there are no restricted domains.

#### `web_crawling_allowed_sites`

```bash
    "web_crawling_allowed_sites": [],
```

The `web_crawling_allowed_sites` parameter restricts web crawling operations to a specified list of allowed IPs or web addresses. This ensures that the application only accesses pre-approved and safe URLs (`"web_crawling_allowed_sites": ["https://example.com", "https://api.mysite.com"]`).

If left empty (`[]`), the application allows access to all URLs by default (marked with a wildcard in the open-source version).

#### `default_llm`

```bash
    "default_llm": {
        "provider": "azure_openai",
        "model_name" : "gpt-4o",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01",
        "method": "multi-class"
    }
```

The `default_llm` parameter specifies the default LLM that will be used with the [`LLM()` function](/mindsdb_sql/functions/llm_function), the [`TO_MARKDOWN()` function](/mindsdb_sql/functions/to_markdown_function), and as a default model for [agents](/mindsdb_sql/agents/agent).

#### `default_embedding_model`

```bash
    "default_embedding_model": {
        "provider": "azure_openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01"
    }
}
```

The `default_embedding_model` parameter specifies the default embedding model used with knowledge bases. Learn more about the parameters following the [documentation of the `embedding_model` of knowledge bases](/mindsdb_sql/knowledge_bases/create#embedding-model).

#### `default_reranking_model`

```bash
    "default_reranking_model": {
        "provider": "azure_openai",
        "model_name" : "gpt-4o",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01",
        "method": "multi-class"
    }
```

The `default_reranking_model` parameter specifies the default reranking model used with knowledge bases. Learn more about the parameters following the [documentation of the `reranking_model` of knowledge bases](/mindsdb_sql/knowledge_bases/create#reranking-model).

#### `data_catalog`

```bash
{
    "data_catalog": {
        "enabled": true
    }
}
```

This parameter enables the [data catalog](/data_catalog/overview).

### Example

First, create a `config.json` file.

```bash
{
    "permanent_storage": {
        "location": "absent"
    },
    "paths": {
        "root": "/path/to/root/location"
    },
    "auth":{
        "http_auth_enabled": true,
        "username": "username",
        "password": "password"
    },
    "gui": {
        "autoupdate": true
    },
    "api": {
        "http": {
            "host": "127.0.0.1",
            "port": "47334",
            "restart_on_failure": true,
            "max_restart_count": 1,
            "max_restart_interval_seconds": 60
        },
        "mysql": {
            "host": "127.0.0.1",
            "port": "47335",
            "database": "mindsdb",
            "ssl": true,
            "restart_on_failure": true,
            "max_restart_count": 1,
            "max_restart_interval_seconds": 60
        }
    },
    "cache": {
        "type": "local"
    },
    "logging": {
        "handlers": {
            "console": {
                "enabled": true,
                "formatter": "default",
                "level": "INFO"
            },
            "file": {
                "enabled": false,
                "level": "INFO",
                "filename": "app.log",
                "maxBytes": 524288,
                "backupCount": 3
            }
        }
    },
    "ml_task_queue": {
        "type": "local"
    },
    "url_file_upload": {
           "enabled": true,
           "allowed_origins": ["https://example.com"],
           "disallowed_origins": ["http://example.com"]
    },
    "web_crawling_allowed_sites": []
}
```

Next, start MindsDB providing this `config.json` file.

```bash
python -m mindsdb --config=/path-to-the-extended-config-file/config.json
```

## Modifying Config Values

Users can modify config values by directly editing the `config.json` file they created.



# Environment Variables

Most of the MindsDB functionality can be modified by extending the default configuration, but some of the configuration options
can be added as environment variables on the server where MindsDB is deployed.

## MindsDB Authentication

MindsDB does not require authentication by default. If you want to enable authentication, you can set the `MINDSDB_USERNAME` and `MINDSDB_PASSWORD` environment variables.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_USERNAME='mindsdb_user' -e MINDSDB_PASSWORD='mindsdb_password' -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_USERNAME='mindsdb_user'
  export MINDSDB_PASSWORD='mindsdb_password'
  ```
</CodeGroup>

## MindsDB Configuration File

In order to start MindsDB with a [custom configuration file](/setup/custom-config), the `MINDSDB_CONFIG_PATH` environment variable should store the file path.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_CONFIG_PATH=/Users/username/path/config.json -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_CONFIG_PATH=/Users/username/path/config.json
  ```
</CodeGroup>

## MindsDB Storage

By default, MindsDB stores the configuration files by determining appropriate platform-specific directories, e.g. a "user data dir":

* On Linux `~/.local/share/mindsdb/var`
* On MacOS `~/Library/Application Support/mindsdb/var`
* On Windows `C:\Documents and Settings\<User>\Application Data\Local Settings\<AppAuthor>\mindsdb\var`

In the `MINDSDB_STORAGE_DIR` location, MindsDB stores users' data, models and uploaded data files, the static assets for the frontend application and the
`sqlite.db` file.
You can change the default storage location using `MINDSDB_STORAGE_DIR` variable.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_STORAGE_DIR='~/home/mindsdb/var' -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_STORAGE_DIR='~/home/mindsdb/var'
  ```
</CodeGroup>

## MindsDB Configuration Storage

MindsDB uses `sqlite` database by default to store the required configuration as models, projects, files metadata etc.
The full list of the above schemas can be found [here](https://github.com/mindsdb/mindsdb/blob/main/mindsdb/interfaces/storage/db.py#L69). You can change the
default storage option and use different database by adding the new connection string using `MINDSDB_DB_CON` variable.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_DB_CON='postgresql://user:secret@localhost' -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_DB_CON='postgresql://user:secret@localhost'
  ```
</CodeGroup>

## MindsDB APIs

The `MINDSDB_APIS` environment variable lets users define which APIs to start. Learn more about the [available APIs here](/setup/mindsdb-apis).

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_APIS='http,mysql'
  ```
</CodeGroup>

## MindsDB Logs

This environment variable defines the level of logging generated by MindsDB. You can choose one of the values [defined here](https://docs.python.org/3/library/logging.html#logging-levels). The `INFO` level is used by default.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_LOG_LEVEL='DEBUG' -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_LOG_LEVEL='DEBUG'
  ```
</CodeGroup>

## MindsDB Default Project

By default, MindsDB creates a project named `mindsdb` where all the models and other objects are stored. You can change the default project name by setting the `MINDSDB_DEFAULT_PROJECT` environment variable.

If this environment variable is set or modified after MindsDB has started, the default project will be **renamed** accordingly upon restart. To start using the new default project, a `USE` statement will also need to be executed.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_DEFAULT_PROJECT='my_project' -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_DEFAULT_PROJECT='my_project'
  ```
</CodeGroup>

## MindsDB's PID File

When running MindsDB via [Docker](/setup/self-hosted/docker) or [Docker Extension](/setup/self-hosted/docker-desktop), the PID file is not used by default. Users can opt for enabling the PID file by defining the `USE_PIDFILE` environment variable.

If used, the PID file is stored in the temp directory (`$TMPDIR` on MacOS and Linux, `%TEMP%` on Windows) under the `mindsdb` folder.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e USE_PIDFILE=1 -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export USE_PIDFILE=1
  ```
</CodeGroup>

## MindsDB GUI Updates

In order to disable automatic GUI updates, the `MINDSDB_GUI_AUTOUPDATE` environment variable should be set to `false` (or `0`).

By default, the automatic GUI updates are enabled and the `MINDSDB_GUI_AUTOUPDATE` environment variable is set to `true` (or `1`).

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_GUI_AUTOUPDATE=false -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_GUI_AUTOUPDATE=false
  ```
</CodeGroup>

## MindsDB GUI Startup and Updates

In order to not open the MindsDB GUI automatically when starting the instance (and to disable automatic GUI updates), the `MINDSDB_NO_STUDIO` environment variable should be set to `true` (or `1`).

By default, the MindsDB GUI starts automatically when starting the instance (and the automatic GUI updates are enabled), that is, the `MINDSDB_NO_STUDIO` environment variable is set to `false` (or `0`).

Note that the `MINDSDB_NO_STUDIO` is not recommended for the MindsDB instance running in Docker. Instead, use the `MINDSDB_GUI_AUTOUPDATE` environment variable to disable automatic GUI updates.

### Example

<CodeGroup>
  ```bash Docker
  docker run --name mindsdb_container -e MINDSDB_NO_STUDIO=true -e MINDSDB_APIS=http,mysql -p 47334:47334 -p 47335:47335 mindsdb/mindsdb
  ```

  ```bash Shell
  export MINDSDB_NO_STUDIO=true
  ```
</CodeGroup>

# MindsDB APIs

MindsDB provides multiple APIs with optional authentication mechanisms.

## APIs

When you start MindsDB, the following APIs become available:

* **HTTP API**, along with **A2A API** and **MCP API**, runs on port `47334`.

  * Access the MindsDB Editor at `mindsdb-instance-url:47334`

  * Access the MCP API at `mindsdb-instance-url:47334/mcp/`

  * Access the A2A API at `mindsdb-instance-url:47334/a2a/`

* **MySQL API** runs on port `47335`.

  * Connect to MindsDB from database clients as if it were a standard MySQL database.

## Authentication

Authentication mechanism covers HTTP API, A2A API, and MCP API.

You can configure authentication by setting [environment variables](/setup/environment-vars#mindsdb-authentication) or by defining credentials in the [configuration file](/setup/custom-config#auth).

For details on generating and using MindsDB authentication tokens, refer to the [authentication guide](/rest/authentication).


# How to Use Agents

Agents enable conversation with data, including structured and unstructured data connected to MindsDB.

## `CREATE AGENT` Syntax

Here is the syntax for creating an agent:

```sql
CREATE AGENT my_agent
USING
    model = {
        "provider": "openai",
        "model_name" : "gpt-4o",
        "api_key": "sk-abc123",
        "base_url": "http://example.com",
        "api_version": "2024-02-01"
    },
    data = {
         "knowledge_bases": ["project_name.kb_name", ...],
         "tables": ["datasource_conn_name.table_name", ...]
    },
    prompt_template='describe data',
    timeout=10;
```

It creates an agent that uses the defined model and has access to the connected data.

```sql
SHOW AGENTS
WHERE name = 'my_agent';
```

<Note>
  Note that you can insert all tables from a connected data source and all knowledge bases from a project using the `*` syntax.

  ```sql
      ...
      data = {
           "knowledge_bases": ["project_name.*", ...],
           "tables": ["datasource_conn_name.*", ...]
      },
      ...
  ```
</Note>

### `model`

This parameter defines the underlying language model, including:

* `provider`
  It is a required parameter. It defines the model provider from the list below.

* `model_name`
  It is a required parameter. It defines the model name from the list below.

* `api_key`
  It is an optional parameter (applicable to selected providers), which stores the API key to access the model. Users can provide it either in this `api_key` parameter, or using [environment variables](/mindsdb_sql/functions/from_env).

* `base_url`
  It is an optional parameter (applicable to selected providers), which stores the base URL for accessing the model. It is the root URL used to send API requests.

* `api_version`
  It is an optional parameter (applicable to selected providers), which defines the API version.

The available models and providers include the following.

<AccordionGroup>
  <Accordion title="Anthropic">
    Available models:

    * claude-3-opus-20240229
    * claude-3-sonnet-20240229
    * claude-3-haiku-20240307
    * claude-2.1
    * claude-2.0
    * claude-instant-1.2
  </Accordion>

  <Accordion title="Bedrock">
    Available models include all models accessible from Bedrock.

    Note that in order to use Bedrock as a model provider, you should ensure the following packages are installed: `langchain_aws` and `transformers`.

    The following parameters are specific to this provider:

    * `aws_region_name` is a required parameter.
    * `aws_access_key_id` is a required parameter.
    * `aws_secret_access_key` is a required parameter.
    * `aws_session_token` is an optional parameter. It may be required depending on the AWS permissions setup.
  </Accordion>

  <Accordion title="Google">
    Available models:

    * gemini-2.5-pro-preview-03-25
    * gemini-2.0-flash
    * gemini-2.0-flash-lite
    * gemini-1.5-flash
    * gemini-1.5-flash-8b
    * gemini-1.5-pro
  </Accordion>

  <Accordion title="Ollama">
    Available models:

    * gemma
    * llama2
    * mistral
    * mixtral
    * llava
    * neural-chat
    * codellama
    * dolphin-mixtral
    * qwen
    * llama2-uncensored
    * mistral-openorca
    * deepseek-coder
    * nous-hermes2
    * phi
    * orca-mini
    * dolphin-mistral
    * wizard-vicuna-uncensored
    * vicuna
    * tinydolphin
    * llama2-chinese
    * openhermes
    * zephyr
    * nomic-embed-text
    * tinyllama
    * openchat
    * wizardcoder
    * phind-codellama
    * starcoder
    * yi
    * orca2
    * falcon
    * starcoder2
    * wizard-math
    * dolphin-phi
    * nous-hermes
    * starling-lm
    * stable-code
    * medllama2
    * bakllava
    * codeup
    * wizardlm-uncensored
    * solar
    * everythinglm
    * sqlcoder
    * nous-hermes2-mixtral
    * stable-beluga
    * yarn-mistral
    * samantha-mistral
    * stablelm2
    * meditron
    * stablelm-zephyr
    * magicoder
    * yarn-llama2
    * wizard-vicuna
    * llama-pro
    * deepseek-llm
    * codebooga
    * mistrallite
    * dolphincoder
    * nexusraven
    * open-orca-platypus2
    * all-minilm
    * goliath
    * notux
    * alfred
    * megadolphin
    * xwinlm
    * wizardlm
    * duckdb-nsql
    * notus
  </Accordion>

  <Accordion title="OpenAI">
    Available models:

    * gpt-3.5-turbo
    * gpt-3.5-turbo-16k
    * gpt-3.5-turbo-instruct
    * gpt-4
    * gpt-4-32k
    * gpt-4-1106-preview
    * gpt-4-0125-preview
    * gpt-4.1
    * gpt-4.1-mini
    * gpt-4o
    * o4-mini
    * o3-mini
    * o1-mini
  </Accordion>

  <Accordion title="Nvidia NIM">
    Available models:

    * microsoft/phi-3-mini-4k-instruct
    * mistralai/mistral-7b-instruct-v0.2
    * writer/palmyra-med-70b
    * mistralai/mistral-large
    * mistralai/codestral-22b-instruct-v0.1
    * nvidia/llama3-chatqa-1.5-70b
    * upstage/solar-10.7b-instruct
    * google/gemma-2-9b-it
    * adept/fuyu-8b
    * google/gemma-2b
    * databricks/dbrx-instruct
    * meta/llama-3\_1-8b-instruct
    * microsoft/phi-3-medium-128k-instruct
    * 01-ai/yi-large
    * nvidia/neva-22b
    * meta/llama-3\_1-70b-instruct
    * google/codegemma-7b
    * google/recurrentgemma-2b
    * google/gemma-2-27b-it
    * deepseek-ai/deepseek-coder-6.7b-instruct
    * mediatek/breeze-7b-instruct
    * microsoft/kosmos-2
    * microsoft/phi-3-mini-128k-instruct
    * nvidia/llama3-chatqa-1.5-8b
    * writer/palmyra-med-70b-32k
    * google/deplot
    * meta/llama-3\_1-405b-instruct
    * aisingapore/sea-lion-7b-instruct
    * liuhaotian/llava-v1.6-mistral-7b
    * microsoft/phi-3-small-8k-instruct
    * meta/codellama-70b
    * liuhaotian/llava-v1.6-34b
    * nv-mistralai/mistral-nemo-12b-instruct
    * microsoft/phi-3-medium-4k-instruct
    * seallms/seallm-7b-v2.5
    * mistralai/mixtral-8x7b-instruct-v0.1
    * mistralai/mistral-7b-instruct-v0.3
    * google/paligemma
    * google/gemma-7b
    * mistralai/mixtral-8x22b-instruct-v0.1
    * google/codegemma-1.1-7b
    * nvidia/nemotron-4-340b-instruct
    * meta/llama3-70b-instruct
    * microsoft/phi-3-small-128k-instruct
    * ibm/granite-8b-code-instruct
    * meta/llama3-8b-instruct
    * snowflake/arctic
    * microsoft/phi-3-vision-128k-instruct
    * meta/llama2-70b
    * ibm/granite-34b-code-instruct
  </Accordion>

  <Accordion title="Writer">
    Available models:

    * palmyra-x5
    * palmyra-x4
  </Accordion>
</AccordionGroup>

Users can define the model for the agent choosing one of the following options.

**Option 1.** Use the `model` parameter to define the specification.

```sql
CREATE AGENT my_agent
USING
    model = {
        "provider": "openai",
        "model_name" : "got-4o",
        "api_key": "sk-abc123",
        "base_url": "https://example.com/",
        "api_version": "2024-02-01"
    },
    ...
```

**Option 2.** Define the default model in the [MindsDB configuration file](/setup/custom-config).

If you define `default_llm` in the configuration file, you do not need to provide the `model` parameter when creating an agent. If provide both, then the values from the `model` parameter are used.

<Tip>
  You can define the default models in the Settings of the MindsDB Editor GUI.
</Tip>

```bash
"default_llm": {

      "provider": "openai",
      "model_name" : "got-4o",
      "api_key": "sk-abc123",
      "base_url": "https://example.com/",
      "api_version": "2024-02-01"

}
```

### `data`

This parameter stores data connected to the agent, including knowledge bases and data sources connected to MindsDB.

The following parameters store the list of connected data.

* `knowledge_bases` stores the list of [knowledge bases](/mindsdb_sql/knowledge_bases/overview) to be used by the agent.

* `tables` stores the list of tables from data sources connected to MindsDB.

### `prompt_template`

This parameter stores instructions for the agent.

It is recommended to provide data description of the data sources listed in the `knowledge_bases` and `tables` parameters to help the agent locate relevant data for answering questions.

### `timeout`

This parameter defines the time the agent can take to come back with an answer.

For example, when the `timeout` parameter is set to 10, the agent has 10 seconds to return an answer. If the agent takes longer than 10 seconds, it aborts the process and comes back with an answer indicating its failure to return an answer within the defined time interval.

## `SELECT FROM AGENT` Syntax

Query an agent to generate responses to questions.

```sql
SELECT answer
FROM my_agent 
WHERE question = 'What is the average number of orders per customers?';
```

You can redefine the agent's parameters at the query time as below.

```sql
SELECT answer
FROM my_agent 
WHERE question = 'What is the average number of orders per customers?';
USING
    model = {
        "provider": "openai",
        "model_name" : "gpt-4.1",
        "api_key": "sk-abc123"
    },
    data = {
         "knowledge_bases": ["project_name.kb_name", ...],
         "tables": ["datasource_conn_name.table_name", ...]
    },
    prompt_template='describe data',
    timeout=10;
```

The `USING` clause may contain any combination of parameters from the `CREATE AGENT` command, depending on which parameters users want to update for the query.

For example, users may want to check the performance of other models to decide which model works better for their use case.

```sql
SELECT answer
FROM my_agent 
WHERE question = 'What is the average number of orders per customers?';
USING
    model = {
        "provider": "google",
        "model_name" : "gemini-2.5-flash",
        "api_key": "ABc123"
    };
```

## `ALTER AGENT` Syntax

Update existing agents with new data, model, or prompt.

```sql
ALTER AGENT my_agent
USING
    model = {
        "provider": "openai",
        "model_name" : "gpt-4.1",
        "api_key": "sk-abc123",
        "base_url": "http://example.com",
        "api_version": "2024-02-01"
    },
    data = {
         "knowledge_bases": ["project_name.kb_name", ...],
         "tables": ["datasource_conn_name.table_name", ...]
    },
    prompt_template='describe data';
```

Note that all parameters are optional. Users can update any combination of parameters.

<Tip>
  See detailed descriptions of parameters in the [`CREATE AGENT` section](/mindsdb_sql/agents/agent_syntax#create-agent-syntax).
</Tip>

Here is how to connect new data to an agent.

```sql
ALTER AGENT my_agent
USING
    data = {
         "knowledge_bases": ["mindsdb.sales_kb"],
         "tables": ["mysql_db.car_sales", "mysql_db.car_info"]
    };
```

And here is how to update a model used by the agent.

```sql
ALTER AGENT my_agent
USING
    model = {
        "provider": "openai",
        "model_name" : "gpt-4.1",
        "api_key": "sk-abc123"
    };
```

## `DROP AGENT` Syntax

Here is the syntax for deleting an agent:

```sql
DROP AGENT my_agent;
```


# How to Create Knowledge Bases

A knowledge base is an advanced system that organizes information based on semantic meaning rather than simple keyword matching. It integrates embedding models, reranking models, and vector stores to enable context-aware data retrieval.

## `CREATE KNOWLEDGE_BASE` Syntax

Here is the syntax for creating a knowledge base:

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-..."
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-..."
    },
    storage = my_vector_store.storage_table,
    metadata_columns = ['date', 'creator', ...],
    content_columns = ['review', 'content', ...],
    id_column = 'id';
```

Upon execution, it registers `my_kb` and associates the specified models and storage. `my_kb` is a unique identifier of the knowledge base within MindsDB.

Here is how to list all knowledge bases:

```sql  theme={null}
SHOW KNOWLEDGE_BASES;
```

<Tip>
  Users can use the variables and the [`from_env()` function](/mindsdb_sql/functions/from_env) to pass parameters when creating knowledge bases.
</Tip>

<Note>
  As MindsDB stores objects, such as models or knowledge bases, inside [projects](/mindsdb_sql/sql/create/project), you can create a knowledge base inside a custom project.

  ```sql  theme={null}
  CREATE PROJECT my_project;

  CREATE KNOWLEDGE_BASE my_project.my_kb
  USING
      ...
  ```
</Note>

### Supported LLMs

Below is the list of all language models supported for the `embedding_model` and `reranking_model` parameters.

#### `provider = 'openai'`

This provider is supported for both `embedding_model` and `reranking_model`.

<Note>
  Users can define the default embedding and reranking models from OpenAI in Settings of the MindsDB GUI.

  Furthermore, users can select `Custom OpenAI API` from the dropdown and use models from any OpenAI-compatible API.
</Note>

When choosing `openai` as the model provider, users should define the following model parameters.

* `model_name` stores the name of the OpenAI model to be used.
* `api_key` stores the OpenAI API key.

Learn more about the [OpenAI integration with MindsDB here](/integrations/ai-engines/openai).

#### `provider = 'openai_azure'`

This provider is supported for both `embedding_model` and `reranking_model`.

<Note>
  Users can define the default embedding and reranking models from Azure OpenAI in Settings of the MindsDB GUI.
</Note>

When choosing `openai_azure` as the model provider, users should define the following model parameters.

* `model_name` stores the name of the OpenAI model to be used.
* `api_key` stores the OpenAI API key.
* `base_url` stores the base URL of the Azure instance.
* `api_version` stores the version of the Azure instance.

<Tip>
  Users need to log in to their Azure OpenAI instance to retrieve all relevant parameter values. Next, click on `Explore Azure AI Foundry portal` and go to `Models + endpoints`. Select the model and copy the parameter values.
</Tip>

#### `provider = 'google'`

This provider is supported for both `embedding_model` and `reranking_model`.

<Note>
  Users can define the default embedding and reranking models from Google in Settings of the MindsDB GUI.
</Note>

When choosing `google` as the model provider, users should define the following model parameters.

* `model_name` stores the name of the Google model to be used.
* `api_key` stores the Google API key.

Learn more about the [Google Gemini integration with MindsDB here](/integrations/ai-engines/google_gemini).

#### `provider = 'bedrock'`

This provider is supported for both `embedding_model` and `reranking_model`.

When choosing `bedrock` as the model provider, users should define the following model parameters.

* `model_name` stores the name of the model available via Amazon Bedrock.
* `aws_access_key_id` stores a unique identifier associated with your AWS account, used to identify the user or application making requests to AWS.
* `aws_region_name` stores the name of the AWS region you want to send your requests to (e.g., `"us-west-2"`).
* `aws_secret_access_key` stores the secret key associated with your AWS access key ID. It is used to sign your requests securely.
* `aws_session_token` is an optional parameter that stores a temporary token used for short-term security credentials when using AWS Identity and Access Management (IAM) roles or temporary credentials.

#### `provider = 'snowflake'`

This provider is supported for `reranking_model`. Note that Snowflake Cortex AI does not offer embedding models as of now.

When choosing `snowflake` as the model provider, users should choose one of the available models from [Snowflake Cortex AI](https://www.snowflake.com/en/product/features/cortex/) and define the following model parameters.

* `model_name` stores the name of the model available via Snowflake Cortex AI.
* `api_key` stores the Snowflake Cortex AI API key.
* `snowflake_account_id` stores the Snowflake account ID.

<Accordion title="How to Generate the API key of Snowflake Cortex AI">
  Follow the below steps to generate the API key.

  1. Generate a key pair according to [this instruction](https://docs.snowflake.com/en/user-guide/key-pair-auth) as below.

     * Execute these commands in the console:

       ```bash  theme={null}
       # generate private key
       openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
       # generate public key
       openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
       ```

     * Save the public key, that is, the content of rsa\_key.pub, into your database user:

       ```sql  theme={null}
       ALTER USER my_user SET RSA_PUBLIC_KEY = "<content of rsa_key.pub>"
       ```

  2. Verify the key pair with the database user.

     * Install `snowsql` following [this instruction](https://docs.snowflake.com/en/user-guide/snowsql-install-config).

     * Execute this command in the console:

       ```bash  theme={null}
       snowsql -a <snowflake-account-id> -u my_user --private-key-path rsa_key.p8
       ```

  3. Generate JWT token.

     * Download the Python script from [Snowflake's Developer Guide for Authentication](https://docs.snowflake.com/en/developer-guide/sql-api/authenticating). Here is a [direct download link](https://docs.snowflake.com/en/_downloads/aeb84cdfe91dcfbd889465403b875515/sql-api-generate-jwt.py).

     * Ensure to have the PyJWT module installed that is required for running the script.

     * Run the script using this command:

       ```bash  theme={null}
       sql-api-generate-jwt.py --account <snowflake-account-id> --user my_user --private_key_file_path rsa_key.p8
       ```

       This command returns the JWT token, which is used in the `api_key` parameter for the `snowflake` provider.
</Accordion>

#### `provider = 'ollama'`

This provider is supported for both `embedding_model` and `reranking_model`.

<Note>
  Users can define the default embedding and reranking models from Ollama in Settings of the MindsDB GUI.
</Note>

When choosing `ollama` as the model provider, users should define the following model parameters.

* `model_name` stores the name of the model to be used.
* `base_url` stores the base URL of the Ollama instance.

### `embedding_model`

The embedding model is a required component of the knowledge base. It stores specifications of the embedding model to be used.

Users can define the embedding model choosing one of the following options.

**Option 1.** Use the `embedding_model` parameter to define the specification.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    embedding_model = {

        "provider": "azure_openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01"

    },
    ...
```

**Option 2.** Define the default embedding model in the [MindsDB configuration file](/setup/custom-config).

<Tip>
  You can define the default models in the Settings of the MindsDB Editor GUI.
</Tip>

<Note>
  Note that if you define [`default_embedding_model` in the configuration file](/setup/custom-config#default_embedding_model), you do not need to provide the `embedding_model` parameter when creating a knowledge base. If provide both, then the values from the `embedding_model` parameter are used.

  When using `default_embedding_model` from the configuration file, the knowledge base saves this model internally. Therefore, when changing `default_embedding_model` in the configuration file to a different one after the knowledge base is created, it does not affect the already created knowledge bases.
</Note>

```bash  theme={null}
"default_embedding_model": {

   "provider": "azure_openai",
   "model_name" : "text-embedding-3-large",
   "api_key": "sk-abc123",
   "base_url": "https://ai-6689.openai.azure.com/",
   "api_version": "2024-02-01"

}
```

The embedding model specification includes:

* `provider`
  It is a required parameter. It defines the model provider.

* `model_name`
  It is a required parameter. It defines the embedding model name as specified by the provider.

* `api_key`
  The API key is required to access the embedding model assigned to a knowledge base. Users can provide it either in this `api_key` parameter, or in the `OPENAI_API_KEY` environment variable for `"provider": "openai"` and `AZURE_OPENAI_API_KEY` environment variable for `"provider": "azure_openai"`.

* `base_url`
  It is an optional parameter, which defaults to `https://api.openai.com/v1/`. It is a required parameter when using the `azure_openai` provider. It is the root URL used to send API requests.

* `api_version`
  It is an optional parameter. It is a required parameter when using the `azure_openai` provider. It defines the API version.

### `reranking_model`

The reranking model is an optional component of the knowledge base. It stores specifications of the reranking model to be used.

Users can disable reranking features of knowledge bases by setting this parameter to `false`.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    reranking_model = false,
    ...
```

Users can enable reranking features of knowledge bases by defining the reranking model choosing one of the following options.

**Option 1.** Use the `reranking_model` parameter to define the specification.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    reranking_model = {

        "provider": "azure_openai",
        "model_name" : "gpt-4o",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01",
        "method": "multi-class"

    },
    ...
```

**Option 2.** Define the default reranking model in the [MindsDB configuration file](/setup/custom-config).

<Tip>
  You can define the default models in the Settings of the MindsDB Editor GUI.
</Tip>

<Note>
  Note that if you define [`default_reranking_model` in the configuration file](/setup/custom-config#default-reranking-model), you do not need to provide the `reranking_model` parameter when creating a knowledge base. If provide both, then the values from the `reranking_model` parameter are used.

  When using `default_reranking_model` from the configuration file, the knowledge base saves this model internally. Therefore, when changing `default_reranking_model` in the configuration file to a different one after the knowledge base is created, it does not affect the already created knowledge bases.
</Note>

```bash  theme={null}
"default_reranking_model": {

  "provider": "azure_openai",
  "model_name" : "gpt-4o",
  "api_key": "sk-abc123",
  "base_url": "https://ai-6689.openai.azure.com/",
  "api_version": "2024-02-01",
  "method": "multi-class"

}
```

The reranking model specification includes:

* `provider`
  It is a required parameter. It defines the model provider as listed in [supported LLMs](/mindsdb_sql/knowledge_bases/create#supported-llms).

* `model_name`
  It is a required parameter. It defines the embedding model name as specified by the provider.

* `api_key`
  The API key is required to access the embedding model assigned to a knowledge base. Users can provide it either in this `api_key` parameter, or in the `OPENAI_API_KEY` environment variable for `"provider": "openai"` and `AZURE_OPENAI_API_KEY` environment variable for `"provider": "azure_openai"`.

* `base_url`
  It is an optional parameter, which defaults to `https://api.openai.com/v1/`. It is a required parameter when using the `azure_openai` provider. It is the root URL used to send API requests.

* `api_version`
  It is an optional parameter. It is a required parameter when using the `azure_openai` provider. It defines the API version.

* `method`
  It is an optional parameter. It defines the method used to calculate the relevance of the output rows. The available options include `multi-class` and `binary`. It defaults to `multi-class`.

<Info>
  **Reranking Method**

  The `multi-class` reranking method classifies each document chunk (that meets any specified metadata filtering conditions) into one of four relevance classes:

  1. Not relevant with class weight of 0.25.
  2. Slightly relevant with class weight of 0.5.
  3. Moderately relevant with class weight of 0.75.
  4. Highly relevant with class weight of 1.

  The overall `relevance_score` of a document is calculated as the sum of each chunk’s class weight multiplied by its class probability (from model logprob output).

  The `binary` reranking method simplifies classification by determining whether a document is relevant or not, without intermediate relevance levels. With this method, the overall `relevance_score` of a document is calculated based on the model log probability.
</Info>

### `storage`

The vector store is a required component of the knowledge base. It stores data in the form of embeddings.

It is optional for users to provide the `storage` parameter. If not provided, the default ChromaDB is created when creating a knowledge base.

The available options include either [PGVector](/integrations/vector-db-integrations/pgvector) or [ChromaDB](/integrations/vector-db-integrations/chromadb).

<Tip>
  It is recommended to use PGVector version 0.8.0 or higher for a better performance.
</Tip>

If the `storage` parameter is not provided, the system creates the default ChromaDB vector database called `<kb_name>_chromadb` with the default table called `default_collection` that stores the embedded data. This default ChromaDB vector database is stored in MindsDB's storage.

In order to provide the storage vector database, it is required to connect it to MindsDB beforehand.

Here is an example for [PGVector](/integrations/vector-db-integrations/pgvector).

```sql  theme={null}
CREATE DATABASE my_pgvector
WITH ENGINE = 'pgvector',
PARAMETERS = {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "postgres",
    "user": "user",
    "password": "password",
    "distance": "cosine"
};

CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    storage = my_pgvector.storage_table,
    ...
```

<Info>
  Note that you do not need to have the `storage_table` created as it is created when creating a knowledge base.
</Info>

### `metadata_columns`

The data inserted into the knowledge base can be classified as metadata, which enables users to filter the search results using defined data fields.

<Note>
  Note that source data column(s) included in `metadata_columns` cannot be used in `content_columns`, and vice versa.
</Note>

This parameter is an array of strings that lists column names from the source data to be used as metadata. If not provided, then all inserted columns (except for columns defined as `id_column` and `content_columns`) are considered metadata columns.

Here is an example of usage. A user wants to store the following data in a knowledge base.

```sql  theme={null}
+----------+-------------------+------------------------+
| order_id | product           | notes                  |
+----------+-------------------+------------------------+
| A1B      | Wireless Mouse    | Request color: black   |
| 3XZ      | Bluetooth Speaker | Gift wrap requested    |
| Q7P      | Laptop Stand      | Prefer aluminum finish |
+----------+-------------------+------------------------+
```

<Tip>
  Go to the *Complete Example* section below to find out how to access this sample data.
</Tip>

The `product` column can be used as metadata to enable metadata filtering.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    metadata_columns = ['product'],
    ...
```

### `content_columns`

The data inserted into the knowledge base can be classified as content, which is embedded by the embedding model and stored in the underlying vector store.

<Note>
  Note that source data column(s) included in `content_columns` cannot be used in `metadata_columns`, and vice versa.
</Note>

This parameter is an array of strings that lists column names from the source data to be used as content and processed into embeddings. If not provided, the `content` column is expected by default when inserting data into the knowledge base.

Here is an example of usage. A user wants to store the following data in a knowledge base.

```sql  theme={null}
+----------+-------------------+------------------------+
| order_id | product           | notes                  |
+----------+-------------------+------------------------+
| A1B      | Wireless Mouse    | Request color: black   |
| 3XZ      | Bluetooth Speaker | Gift wrap requested    |
| Q7P      | Laptop Stand      | Prefer aluminum finish |
+----------+-------------------+------------------------+
```

<Tip>
  Go to the *Complete Example* section below to find out how to access this sample data.
</Tip>

The `notes` column can be used as content.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    content_columns = ['notes'],
    ...
```

### `id_column`

The ID column uniquely identifies each source data row in the knowledge base.

It is an optional parameter. If provided, this parameter is a string that contains the source data ID column name. If not provided, it is generated from the hash of the content columns.

Here is an example of usage. A user wants to store the following data in a knowledge base.

```sql  theme={null}
+----------+-------------------+------------------------+
| order_id | product           | notes                  |
+----------+-------------------+------------------------+
| A1B      | Wireless Mouse    | Request color: black   |
| 3XZ      | Bluetooth Speaker | Gift wrap requested    |
| Q7P      | Laptop Stand      | Prefer aluminum finish |
+----------+-------------------+------------------------+
```

<Tip>
  Go to the *Complete Example* section below to find out how to access this sample data.
</Tip>

The `order_id` column can be used as ID.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    id_column = 'order_id',
    ...
```

<Info>
  Note that if the source data row is chunked into multiple chunks by the knowledge base (that is, to optimize the storage), then these rows in the knowledge base have the same ID value that identifies chunks from one source data row.
</Info>

<Note>
  **Available options for the ID column values**

  * User-Defined ID Column: <br />
    When users defined the `id_column` parameter, the values from the provided source data column are used to identify source data rows within the knowledge base.

  * User-Generated ID Column: <br />
    When users do not have a column that uniquely identifies each row in their source data, they can generate the ID column values when inserting data into the knowledge base using functions like `HASH()` or `ROW_NUMBER()`.

  ```sql  theme={null}
  INSERT INTO my_kb (
      SELECT ROW_NUMBER() OVER (ORDER BY order_id) AS id, *
      FROM sample_data.orders
  );
  ```

  * Default ID Column: <br />
    If the `id_column` parameter is not defined, its default values are build from the hash of the content columns and follow the format: `<first 16 char of md5 hash of row content>`.
</Note>

### Example

Here is a sample knowledge base that will be used for examples in the following content.

```sql  theme={null}
CREATE KNOWLEDGE_BASE my_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-abc123"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-abc123"
    },
    metadata_columns = ['product'],
    content_columns = ['notes'],
    id_column = 'order_id';
```

## `DESCRIBE KNOWLEDGE_BASE` Syntax

Users can get details about the knowledge base using the `DESCRIBE KNOWLEDGE_BASE` command.

```sql  theme={null}
DESCRIBE KNOWLEDGE_BASE my_kb;
```

Here is the sample output:

```sql  theme={null}
+---------+---------+--------+----------------------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-------------------+--------------------+----------------+-------+----------+
| NAME    | PROJECT | MODEL  | STORAGE                                | PARAMS                                                                                                                                                                                                                                       | INSERT_STARTED_AT | INSERT_FINISHED_AT | PROCESSED_ROWS | ERROR | QUERY_ID |
+---------+---------+--------+----------------------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-------------------+--------------------+----------------+-------+----------+
| my_kb   | mindsdb | [NULL] | my_kb_chromadb.default_collection      | {"embedding_model": {"provider": "openai", "model_name": "text-embedding-ada-002", "api_key": "sk-xxx"}, "reranking_model": {"provider": "openai", "model_name": "gpt-4o", "api_key": "sk-xxx"}, "default_vector_storage": "my_kb_chromadb"} | [NULL]            | [NULL]             | [NULL]         | [NULL]| [NULL]   |
+---------+---------+--------+----------------------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-------------------+--------------------+----------------+-------+----------+
```

## `DROP KNOWLEDGE_BASE` Syntax

Here is the syntax for deleting a knowledge base:

```sql  theme={null}
DROP KNOWLEDGE_BASE my_kb;
```

Upon execution, it removes the knowledge base with its content.

Upon execution, it identifies matching records based on the user-defined condition and removes all associated data (metadata, content, chunks, embeddings) for matching records from the KB's storage.

# How to Insert Data into Knowledge Bases

Knowledge Bases (KBs) organize data across data sources, including databases, files, documents, webpages, enabling efficient search capabilities.

Here is what happens to data when it is inserted into the knowledge base.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=0b15779acc8997d4744a7823b6eb70b2" data-og-width="2303" width="2303" data-og-height="2355" height="2355" data-path="assets/kb_data_insertion.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=280&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=0910d1771c8384ea0f724b4dca6f6dd1 280w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=560&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=c36dddcdef8d51b746270becd07e1d33 560w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=840&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=2f5ac9ce35a44c315fbf70abb6ac6da6 840w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=1100&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=4a21551192b23e01b67d37327513c5bd 1100w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=1650&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=b6984d423730a9c0f3ca3b99fef27f6d 1650w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_data_insertion.png?w=2500&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=3cc30c4408422d52cc9b1b954d178bad 2500w" />
</p>

Upon inserting data into the knowledge base, it is split into chunks, transformed into the embedding representation to enhance the search capabilities, and stored in a vector database.

## `INSERT INTO` Syntax

Here is the syntax for inserting data into a knowledge base:

```sql
INSERT INTO my_kb
SELECT order_id, product, notes
FROM sample_data.orders;
```

Upon execution, it inserts data into a knowledge base, using the embedding model to embed it into vectors before inserting into an underlying vector database.

<Tip>
  The status of the `INSERT INTO` is logged in the `information_schema.queries` table with the timestamp when it was ran, and can be queried as follows:

  ```sql
  SELECT *
  FROM information_schema.queries;
  ```
</Tip>

<Info>
  To speed up data insertion, you can use these performance optimization flags:

  **Skip duplicate checking (kb\_no\_upsert)**

  ```sql
  INSERT INTO my_kb
  SELECT *
  FROM table_name
  USING kb_no_upsert = true;
  ```

  This skips all duplicate checking and directly inserts data. Use only when the knowledge base is empty (initial data load).

  **Skip existing items (kb\_skip\_existing)**

  ```sql
  INSERT INTO my_kb
  SELECT *
  FROM table_name
  USING kb_skip_existing = true;
  ```

  This checks for existing items and skips them entirely, including avoiding embedding calculation for existing content. More efficient than upsert when you only want to insert new items.
</Info>

<Note>
  **Handling duplicate data while inserting into the knowledge base**

  Knowledge bases uniquely identify data rows using an ID column, which prevents from inserting duplicate data, as follows.

  * **Case 1: Inserting data into the knowledge base without the `id_column` defined.**

    When users do not define the `id_column` during the creation of a knowledge base, MindsDB generates the ID for each row using a hash of the content columns, as [explained here](/mindsdb_sql/knowledge_bases/create#id-column).

    **Example:**

    If two rows have exactly the same content in the content columns, their hash (and thus their generated ID) will be the same.

    Note that duplicate rows are skipped and not inserted.

    Since both rows in the below table have the same content, only one row will be inserted.

    | name  | age |
    | ----- | --- |
    | Alice | 25  |
    | Alice | 25  |

  * **Case 2: Inserting data into the knowledge base with the `id_column` defined.**

    When users define the `id_column` during the creation of a knowledge base, then the knowledge base uses that column's values as the row ID.

    **Example:**

    If the `id_column` has duplicate values, the knowledge base skips the duplicate row(s) during the insert.

    The second row in the below table has the same `id` as the first row, so only one of these rows is inserted.

    | id | name  | age |
    | -- | ----- | --- |
    | 1  | Alice | 25  |
    | 1  | Bob   | 30  |

  **Best practice**

  Ensure the `id_column` uniquely identifies each row to avoid unintentional data loss due to duplicate ID skipping.

  **Performance optimization for duplicate handling**

  For better performance when handling duplicates, you can use:

  * `kb_skip_existing = true`: Checks for existing IDs and skips them completely (no embedding calculation, more efficient)
  * `kb_no_upsert = true`: Skips duplicate checking entirely (fastest, use only for initial load into empty KB)
</Note>

### Update Existing Data

In order to update existing data in the knowledge base, insert data with the column ID that you want to update and the updated content.

Here is an example of usage. A knowledge base stores the following data.

```sql
+----------+-------------------+------------------------+
| order_id | product           | notes                  |
+----------+-------------------+------------------------+
| A1B      | Wireless Mouse    | Request color: black   |
| 3XZ      | Bluetooth Speaker | Gift wrap requested    |
| Q7P      | Laptop Stand      | Prefer aluminum finish |
+----------+-------------------+------------------------+
```

A user updated `Laptop Stand` to `Aluminum Laptop Stand`.

```sql
+----------+-----------------------+------------------------+
| order_id | product               | notes                  |
+----------+-----------------------+------------------------+
| A1B      | Wireless Mouse        | Request color: black   |
| 3XZ      | Bluetooth Speaker     | Gift wrap requested    |
| Q7P      | Aluminum Laptop Stand | Prefer aluminum finish |
+----------+-----------------------+------------------------+
```

<Tip>
  Go to the *Complete Example* section below to find out how to access this sample data.
</Tip>

Here is how to propagate this change into the knowledge base.

```sql
INSERT INTO my_kb
SELECT order_id, product, notes
FROM sample_data.orders
WHERE order_id = 'Q7P';
```

The knowledge base matches the ID value to the existing one and updates the data if required.

### Insert Data using Partitions

In order to optimize the performance of data insertion into the knowledge base, users can set up partitions and threads to insert batches of data in parallel. This also enables tracking the progress of data insertion process including cancelling and resuming it if required.

Here is an example.

```sql
INSERT INTO my_kb
SELECT order_id, product, notes
FROM sample_data.orders
USING
    batch_size = 200,
    track_column = order_id,
    threads = 10,
    error = 'skip';
```

The parameters include the following:

* `batch_size` defines the number of rows fetched per iteration to optimize data extraction from the source. It defaults to 1000.

* `threads` defines threads for running partitions. Note that if the [ML task queue](/setup/custom-config#overview-of-config-parameters) is enabled, threads are used automatically. The available values for `threads` are:
  * a number of threads to be used, for example, `threads = 10`,
  * a boolean value that defines whether to enable threads, setting `threads = true`, or disable threads, setting `threads = false`.

* `track_column` defines the column used for sorting data before partitioning.

* `error` defines the error processing options. The available values include `raise`, used to raise errors as they come, or `skip`, used to subside errors. It defaults to `raise` if not provided.

After executing the `INSERT INTO` statement with the above parameters, users can view the data insertion progress by querying the `information_schema.queries` table.

```sql
SELECT * FROM information_schema.queries;
```

Users can cancel the data insertion process using the process ID from the `information_schema.queries` table.

```sql
SELECT query_cancel(1);
```

Note that canceling the query will not remove the already inserted data.

Users can resume the data insertion process using the process ID from the `information_schema.queries` table.

```sql
SELECT query_resume(1);
```

### Chunking Data

Upon inserting data into the knowledge base, the data chunking is performed in order to optimize the storage and search of data.

Each chunk is identified by its chunk ID of the following format: `<id>:<chunk_number>of<total_chunks>:<start_char_number>to<end_char_number>`.

#### Text

Users can opt for defining the chunking parameters when creating a knowledge base.

```sql
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    preprocessing = {
        "text_chunking_config" : {
            "chunk_size": 2000,
            "chunk_overlap": 200
        }
    },
    ...;
```

The `chunk_size` parameter defines the size of the chunk as the number of characters. And the `chunk_overlap` parameter defines the number of characters that should overlap between subsequent chunks.

#### JSON

Users can opt for defining the chunking parameters specifically for JSON data.

```sql
CREATE KNOWLEDGE_BASE my_kb
USING
    ...
    preprocessing = {
        "type": "json_chunking",
        "json_chunking_config" : {
            ...
        }
    },
    ...;
```

When the `type` of chunking is set to `json_chunking`, users can configure it by setting the following parameter values in the `json_chunking_config` parameter:

* `flatten_nested`\
  It is of the `bool` data type with the default value of `True`.\
  It defines whether to flatten nested JSON structures.

* `include_metadata`\
  It is of the `bool` data type with the default value of `True`.\
  It defines whether to include original metadata in chunks.

* `chunk_by_object`\
  It is of the `bool` data type with the default value of `True`.\
  It defines whether to chunk by top-level objects (`True`) or create a single document (`False`).

* `exclude_fields`\
  It is of the `List[str]` data type with the default value of an empty list.\
  It defines the list of fields to exclude from chunking.

* `include_fields`\
  It is of the `List[str]` data type with the default value of an empty list.\
  It defines the list of fields to include in chunking (if empty, all fields except excluded ones are included).

* `metadata_fields`\
  It is of the `List[str]` data type with the default value of an empty list.\
  It defines the list of fields to extract into metadata for filtering (can include nested fields using dot notation). If empty, all primitive fields will be extracted (top-level fields if available, otherwise all primitive fields in the flattened structure).

* `extract_all_primitives`\
  It is of the `bool` data type with the default value of `False`.\
  It defines whether to extract all primitive values (strings, numbers, booleans) into metadata.

* `nested_delimiter`\
  It is of the `str` data type with the default value of `"."`.\
  It defines the delimiter for flattened nested field names.

* `content_column`\
  It is of the `str` data type with the default value of `"content"`.\
  It defines the name of the content column for chunk ID generation.

### Underlying Vector Store

Each knowledge base has its underlying vector store that stores data inserted into the knowledge base in the form of embeddings.

Users can query the underlying vector store as follows.

* KB with the default ChromaDB vector store:

```sql
SELECT id, content, metadata, embeddings
FROM <kb_name>_chromadb.storage_table;
```

* KB with user-defined vector store (either [PGVector](/integrations/vector-db-integrations/pgvector) or [ChromaDB](/integrations/vector-db-integrations/chromadb)):

```sql
SELECT id, content, metadata, embeddings
FROM <vector_store_connection_name>.<table_name>;
```

### Example

Here a sample knowledge base created in the previous **Example** section is inserted into.

```sql
INSERT INTO my_kb
SELECT order_id, product, notes
FROM sample_data.orders;
```

<Note>
  When inserting into a knowledge base where the `content_columns` parameter was not specified, the column storing content must be aliased `AS content` as below.

  ```sql
  CREATE KNOWLEDGE_BASE my_kb
  USING
      ...
      id_column = 'order_id',
      ...
  ```

  ```sql
  INSERT INTO my_kb
  SELECT order_id, notes AS content
  FROM sample_data.orders;
  ```
</Note>

## `DELETE FROM` Syntax

Here is the syntax for deleting from a knowledge base:

```sql
DELETE FROM my_kb
WHERE id = 'A1B';
```

## `CREATE INDEX ON KNOWLEDGE_BASE` Syntax

Users can create index on the knowledge base to speed up the search operations.

```sql
CREATE INDEX ON KNOWLEDGE_BASE my_kb;
```

<Warning>
  Note that this feature works only when PGVector is used as the [storage of the knowledge base](/mindsdb_sql/knowledge_bases/create#storage), as ChromaDB provides the index features by default.
</Warning>

Upon executing this statement, an index is created on the knowledge base's underlying vector store. This is essentially a database index created on the vector database.

Note that having an index on the knowledge base may reduce the speed of the insert operations. Therefore, it is recommended to insert bulk data into the knowledge base before creating an index. The index improves performance of querying the knowledge base, while it may slow down subsequent data inserts.

# How to Query Knowledge Bases

Knowledge Bases support two primary querying approaches: semantic search and metadata filtering, each of which offers different filtering capabilities, including filtering by the relevance score to ensure only data most relevant to the query is returned.

* **Semantic Search**

  Semantic search enables users to query Knowledge Bases using natural language. When searching semantically, you reference the content column in your SQL statement. MindsDB will interpret the input as a semantic query and use vector-based similarity to find relevant results.

  ```sql
  SELECT * FROM my_kb
  WHERE content = 'what document types store reviews?';
  ```

  <Accordion title="Supported Filtering Operators">
    Only specific operators are allowed when filtering semantically using the content column.

    * Standard vector search: `content = ‘xxx’`, `content LIKE ‘xxx’`
    * Exclusions from search: `id != xxx`, `id <> xxx`, `content NOT LIKE ‘zzz’`
    * Nested queries: `id NOT IN (SELECT DISTINCT id FROM my_kb WHERE content = ‘xxx’)`
    * Multiple queries: `content IN (‘xxx’, ‘yyy’)` which is equivalent to `content = ‘xxx’ OR content = ‘yyy’`, `content NOT IN (‘zzz’, ‘aaa’)`
    * Logical operators: `content = ‘xxx’ OR content = ‘yyy’` which is a union of results for both conditions, `content = ‘xxx’ AND content = ‘yyy’` which is an intersection of results for both conditions
  </Accordion>

* **Metadata Filtering**

  It allows users to query Knowledge Bases based on the available metadata fields. These fields can be used in the `WHERE` clause of a SQL statement.

  ```sql
  SELECT * FROM my_kb
  WHERE document_type = ‘cover letter’
  AND document_author = 'bot';
  ```

  <Accordion title="Supported Filtering Operators">
    You can apply a variety of filtering conditions to metadata columns, such as equality checks, range filters, or pattern matches.

    * Equality checks: `=`, `<>`, `!=`
    * Range filters: `>`, `<`, `>=`, `<=`, `BETWEEN ... AND ...`
    * Pattern matching: `LIKE`, `NOT LIKE`, `IN`, `NOT IN`
    * Logical operators: `AND`, `OR`, `NOT`
  </Accordion>

* **Relevance Filtering**

  Every semantic search result is assigned a relevance score, which indicates how closely a given entry matches your query. You can filter results by this score to ensure only the most relevant entries are returned.

  <Accordion title="Finetune Filtering using Relevance Score">
    Here is how to fine-tune the filtering of data.

    * Start by querying the knowledge base without a WHERE clause on the relevance column. This will show you a range of relevance scores returned by your query.

    * Determine a cutoff relevance value that fits your use case. For example, `relevance > 0.75`.

    * Re-run your query with the condition on `relevance` to restrict results to those above your chosen threshold. The results set contains only data with relevance greater than 0.75.

      ```sql
      SELECT * FROM my_kb
      WHERE content = 'what document types store reviews?’
      AND relevance > 0.75;
      ```
  </Accordion>

<Tip>
  See more [examples here](/mindsdb_sql/knowledge_bases/query#examples).
</Tip>

## `SELECT FROM KB` Syntax

Knowledge bases provide an abstraction that enables users to see the stored data.

Note that here a sample knowledge base created and inserted into in the previous **Example** sections is searched.

```sql
SELECT *
FROM my_kb;
```

Here is the sample output:

```sql
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| id  | chunk_id             | chunk_content           | metadata                                                                                                                                                                                            | distance           | relevance          |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| A1B | A1B_notes:1of1:0to20 | Request color: black    | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0}        | 0.5743341242061104 | 0.5093188026135379 |
| Q7P | Q7P_notes:1of1:0to22 | Prefer aluminum finish  | {"chunk_index":0,"content_column":"notes","end_char":22,"original_doc_id":"Q7P_notes","original_row_id":"Q7P","product":"Aluminum Laptop Stand","source":"TextChunkingPreprocessor","start_char":0} | 0.7744703514692067 | 0.2502580835880018 |
| 3XZ | 3XZ_notes:1of1:0to19 | Gift wrap requested     | {"chunk_index":0,"content_column":"notes","end_char":19,"original_doc_id":"3XZ_notes","original_row_id":"3XZ","product":"Bluetooth Speaker","source":"TextChunkingPreprocessor","start_char":0}     | 0.8010851611432231 | 0.2500003885558766 |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
```

The following columns are stored in the knowledge base.

* `id`
  It stores values from the column defined in the `id_column` parameter when creating the knowledge base. These are the source data IDs.

* `chunk_id`
  Knowledge bases chunk the inserted data in order to fit the defined chunk size. If the chunking is performed, the following chunk ID format is used: `<id>:<chunk_number>of<total_chunks>:<start_char_number>to<end_char_number>`.

* `chunk_content`
  It stores values from the column(s) defined in the `content_columns` parameter when creating the knowledge base.

* `metadata`
  It stores the general metadata and the metadata defined in the `metadata_columns` parameter when creating the knowledge base.

* `distance`
  It stores the calculated distance between the chunk's content and the search phrase.

* `relevance`
  It stores the calculated relevance of the chunk as compared to the search phrase. Its values are between 0 and 1.

<Note>
  Note that the calculation method of `relevance` differs as follows:

  * When the ranking model is provided, the default `relevance` is equal or greater than 0, unless defined otherwise in the `WHERE` clause.
  * When the reranking model is not provided and the `relevance` is not defined in the query, then no relevance filtering is applied and the output includes all rows matched based on the similarity and metadata search.
  * When the reranking model is not provided but the `relevance` is defined in the query, then the relevance is calculated based on the `distance` column (`1/(1+ distance)`) and the `relevance` value is compared with this relevance value to filter the output.
</Note>

### Semantic Search

Users can query a knowledge base using semantic search by providing the search phrase (called `content`) to be searched for.

```sql
SELECT *
FROM my_kb
WHERE content = 'color'
```

Here is the output:

```sql
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| id  | chunk_id             | chunk_content           | metadata                                                                                                                                                                                            | distance           | relevance          |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| A1B | A1B_notes:1of1:0to20 | Request color: black    | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0}        | 0.5743341242061104 | 0.5093188026135379 |
| Q7P | Q7P_notes:1of1:0to22 | Prefer aluminum finish  | {"chunk_index":0,"content_column":"notes","end_char":22,"original_doc_id":"Q7P_notes","original_row_id":"Q7P","product":"Aluminum Laptop Stand","source":"TextChunkingPreprocessor","start_char":0} | 0.7744703514692067 | 0.2502580835880018 |
| 3XZ | 3XZ_notes:1of1:0to19 | Gift wrap requested     | {"chunk_index":0,"content_column":"notes","end_char":19,"original_doc_id":"3XZ_notes","original_row_id":"3XZ","product":"Bluetooth Speaker","source":"TextChunkingPreprocessor","start_char":0}     | 0.8010851611432231 | 0.2500003885558766 |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
```

<Note>
  When querying a knowledge base, the default values include the following:

  * `relevance` <br />
    If not provided, its default value is equal to or greater than 0, ensuring there is no filtering of rows based on their relevance.

  * `LIMIT` <br />
    If not provided, its default value is 10, returning a maximum of 10 rows.
</Note>

<Tip>
  Note that when specifying both `relevance` and `LIMIT` as follows:

  ```sql
  SELECT *
  FROM my_kb
  WHERE content = 'color'
  AND relevance >= 0.5
  LIMIT 20;
  ```

  The query extracts 20 rows (as defined in the `LIMIT` clause) that match the defined `content`. Next, these set of rows is filtered out to match the defined `relevance`.
</Tip>

Users can limit the `relevance` in order to get only the most relevant results.

```sql
SELECT *
FROM my_kb
WHERE content = 'color'
AND relevance >= 0.5;
```

Here is the output:

```sql
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| id  | chunk_id             | chunk_content          | metadata                                                                                                                                                                                     | distance           | relevance          |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| A1B | A1B_notes:1of1:0to20 | Request color: black   | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0} | 0.5743341242061104 | 0.5103766499957533 |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
```

By providing the `relevance` filter, the output is limited to only data with relevance score of the provided value. The available values of `relevance` are between 0 and 1, and its default value covers all available relevance values ensuring no filtering based on the relevance score.

Users can limit the number of rows returned.

```sql
SELECT *
FROM my_kb
WHERE content = 'color'
LIMIT 2;
```

Here is the output:

```sql
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| id  | chunk_id             | chunk_content           | metadata                                                                                                                                                                                            | distance           | relevance          |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
| A1B | A1B_notes:1of1:0to20 | Request color: black    | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0}        | 0.5743341242061104 | 0.5093188026135379 |
| Q7P | Q7P_notes:1of1:0to22 | Prefer aluminum finish  | {"chunk_index":0,"content_column":"notes","end_char":22,"original_doc_id":"Q7P_notes","original_row_id":"Q7P","product":"Aluminum Laptop Stand","source":"TextChunkingPreprocessor","start_char":0} | 0.7744703514692067 | 0.2502580835880018 |
+-----+----------------------+-------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+--------------------+
```

### Metadata Filtering

Besides semantic search features, knowledge bases enable users to filter the result set by the defined metadata.

```sql
SELECT *
FROM my_kb
WHERE product = 'Wireless Mouse';
```

Here is the output:

```sql
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-----------+----------+
| id  | chunk_id             | chunk_content          | metadata                                                                                                                                                                                     | relevance | distance |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-----------+----------+
| A1B | A1B_notes:1of1:0to20 | Request color: black   | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0} | [NULL]    | [NULL]   |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-----------+----------+
```

Note that when searching by metadata alone, the `relevance` column values are not calculated.

Users can do both, filter by metadata and search by content.

```sql
SELECT *
FROM my_kb
WHERE product = 'Wireless Mouse'
AND content = 'color'
AND relevance >= 0.5;
```

Here is the output:

```sql
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+-------------------+
| id  | chunk_id             | chunk_content          | metadata                                                                                                                                                                                     | distance           | relevance         |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+-------------------+
| A1B | A1B_notes:1of1:0to20 | Request color: black   | {"chunk_index":0,"content_column":"notes","end_char":20,"original_doc_id":"A1B_notes","original_row_id":"A1B","product":"Wireless Mouse","source":"TextChunkingPreprocessor","start_char":0} | 0.5743341242061104 | 0.504396172197583 |
+-----+----------------------+------------------------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------+-------------------+
```

## `JOIN` Syntax

Knowledge bases can be used in the standard SQL JOIN statements.

```sql
SELECT t.order_id, t.product, t.notes, kb.chunk_content, kb.relevance
FROM local_postgres.orders AS t
JOIN my_kb AS kb
ON t.order_id = kb.id
WHERE t.order_id = 'A1B'
AND kb.content = 'color'
AND kb.product = 'Wireless Mouse';
```

Here is the output:

```sql
+----------+------------------+------------------------+------------------------+--------------------+
| order_id | product          | notes                  | chunk_content          | relevance          |
+----------+------------------+------------------------+------------------------+--------------------+
| A1B      | Wireless Mouse   | Request color: black   | Request color: black   | 0.5106591666649376 |
+----------+------------------+------------------------+------------------------+--------------------+
```

## Examples

We have a knowledge base that stores data about movies.

```sql
+----------+-----------------------------------+-------------------------------------------------------------------------+
| id       | content                           | metadata                                                                |
+----------+-----------------------------------+-------------------------------------------------------------------------+
| movie_id | "A bank security expert plots..." | {"genre":"Crime","rating":6.3,"expanded_genres":"Comedy, Crime, Drama"} |
+----------+-----------------------------------+-------------------------------------------------------------------------+
```

It uses the `movie_id` column to uniquely identify each entry. The `content` column stores the description of the movie, and the metadata includes `genre`, `rating`, and `expanded_genre` columns.

Let's see the query examples.

* Selecting high-rated action movies with heist themes and no romance.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'heist bank robbery space alien planet'
  AND genre != 'Romance' 
  AND expanded_genres NOT LIKE '%Romance%'
  AND rating > 7.0;
  ```

  This query includes a semantic search filtering condition - `content LIKE 'heist bank robbery space alien planet'` - and multiple metadata filtering conditions - `genre != 'Romance' AND expanded_genres NOT LIKE '%Romance%' AND rating > 7.0`.

* Selecting action-comedies with car chase scenes.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'car chase driving speed race'
  AND expanded_genres LIKE '%Action%'
  AND expanded_genres LIKE '%Comedy%'
  AND rating > 6.5;
  ```

  This query includes a semantic search filtering condition - `content LIKE 'car chase driving speed race'` - and multiple metadata filtering conditions - `expanded_genres LIKE '%Action%' AND expanded_genres LIKE '%Comedy%' AND rating > 6.5`.

* Selecting historical dramas without war themes.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'historical period past century era'
  AND content NOT LIKE 'war battle soldier military'
  AND content NOT LIKE 'fight combat weapon'
  AND expanded_genres LIKE '%Drama%'
  AND rating > 3.5;
  ```

  This query includes multiple semantic search filtering conditions - `content LIKE 'historical period past century era' AND content NOT LIKE 'war battle soldier military' AND content NOT LIKE 'fight combat weapon'` - and multiple metadata filtering conditions - `expanded_genres LIKE '%Drama%' AND rating > 3.5`.

* Selecting multi-genre movies with different ratings.

  ```sql
  SELECT * FROM movies_kb 
  WHERE (content LIKE 'detective mystery investigation' AND (genre = 'Mystery' OR expanded_genres LIKE '%Thriller%'))
  OR (content LIKE 'romance love relationship' AND (genre = 'Romance' OR expanded_genres LIKE '%Romance%'))
  AND rating > 7.0;
  ```

  This query includes nested semantic search filtering conditions - `(content LIKE 'detective mystery investigation' AND (genre = 'Mystery' OR expanded_genres LIKE '%Thriller%'))` - and a metadata filtering condition - `rating > 7.0`.

* Selecting adventure movies excluding some genres.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'adventure journey quest treasure'
  AND genre NOT IN ('Horror', 'Romance', 'Family')
  AND rating > 6.5;
  ```

  This query includes multiple semantic search filtering conditions - `content LIKE 'adventure journey quest treasure'` - and multiple metadata filtering conditions - `genre NOT IN ('Horror', 'Romance', 'Family') AND rating > 6.5`.

* Selecting comedy movies in specific rating range.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'comedy funny humor laugh'
  AND rating BETWEEN 7.0 AND 9.0
  AND expanded_genres LIKE '%Comedy%';
  ```

  This query includes multiple semantic search filtering conditions - `content LIKE 'comedy funny humor laugh'` - and multiple metadata filtering conditions - `rating BETWEEN 7.0 AND 9.0 AND expanded_genres LIKE '%Comedy%'`.

* Selecting different thriller subgenres.

  ```sql
  SELECT * FROM movies_kb 
  WHERE content LIKE 'detective investigation mystery' AND rating > 7.0
  UNION
  SELECT * FROM movies_kb 
  WHERE content LIKE 'heist robbery theft steal' AND rating > 7.0
  UNION
  SELECT * FROM movies_kb 
  WHERE content LIKE 'spy secret agent undercover' AND rating > 7.0;
  ```

  This query combines the results of three queries using the `UNION` operator.

# How to Hybrid Search Knowledge Bases

Knowledge bases support two primary search methods: [semantic search](/mindsdb_sql/knowledge_bases/query#semantic-search) and [metadata/keyword search](/mindsdb_sql/knowledge_bases/query#metadata-filtering). Each method has its strengths and ideal use cases.

Semantic similarity search uses vector embeddings to retrieve content that is semantically related to a given query. This is especially powerful when users are searching for concepts, ideas, or questions expressed in natural language.

However, semantic search may fall short when users are looking for specific keywords, such as acronyms, internal terminology, or custom identifiers. These types of terms are often not well-represented in the embedding model's training data. As a result, embedding-based semantic search might entirely miss results that do contain the exact keyword.

To address this gap, knowledge bases offer hybrid search, which combines the best of both worlds: semantic similarity and exact keyword matching. Hybrid search ensures that results relevant by meaning and results matching specific terms are both considered and ranked appropriately.

## Enabling Hybrid Search

To use hybrid search, you first need to [create a knowledge base](/mindsdb_sql/knowledge_bases/create) and [insert data into it](/mindsdb_sql/knowledge_bases/insert_data).

Hybrid search can be enabled at the time of querying the knowledge base by specifying the appropriate configuration options, as shown below.

```sql
SELECT * from my_kb
WHERE
	content = ”ACME-213”
AND hybrid_search_alpha = 0.8 -- optional, this is 0.5 by default
AND hybrid_search = true;
```

The `hybrid_search` parameter enables hybrid search functionality. While the `hybrid_search_alpha` parameter allows you to control the balance between semantic and keyword relevance, with values varying between 0 (more importance on keyword relevance) and 1 (more importance on semantic relevance) and the default value of 0.5.

<Note>
  Note that hybrid search works only on knowledge bases that use PGVector as a [storage](/mindsdb_sql/knowledge_bases/create#storage).
</Note>

Knowledge bases provide optional [reranking features](/mindsdb_sql/knowledge_bases/create#reranking-model) that users can decide to use in specific use cases. When the reranker is available, it is used to rerank results from both the full-text index search and the embedding-based semantic search. It estimates the relevance of each document and orders them from most to least relevant.

However, users can disable the reranker using `reranking = false`, which might be desirable for performance reasons or specific use cases. When reranking is disabled, the system still needs to combine the two search result sets. In this case, the final ranking of each document is computed as a weighted average of the embedding similarity score and the [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) keyword relevance score from the full-text search.

<Note>
  **Relevance-Based Document Selection for Reranking**

  When retrieving documents from the full-text index, there is a practical limit on how many documents can be passed to the reranker, since reranking is typically computationally expensive. To ensure that only the most promising candidates are selected for reranking, we apply relevance heuristics during the keyword search stage.

  One widely used heuristic is BM25, a ranking function that scores documents based on their keyword relevance to the user query. BM25 considers both the frequency of a keyword within a document and how common that keyword is across the entire corpus.

  By scoring documents using BM25, the system can prioritize more relevant matches and limit reranker input to a smaller, high-quality subset of documents. This helps achieve a balance between performance and retrieval accuracy in hybrid search.
</Note>

This is the so-called alpha reranking.

## Implementation of Hybrid Search

Hybrid search in knowledge bases combines semantic similarity and keyword-based search methods into a unified search mechanism.

The diagram below illustrates the hybrid search process.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=907ac7ffb1eb290857c65e0256e440e3" data-og-width="1414" width="1414" data-og-height="1820" height="1820" data-path="assets/kb_hybrid_search.jpg" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=280&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=80ddd28a7e16e00be3c28096b1d827a8 280w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=560&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=a48dd55cc2693a42aa4359127931f183 560w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=840&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=1ab355dd2c0af1ae8af81b03ead3563d 840w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=1100&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=bc5b4a89fef8e08711def8bda5ce4fa6 1100w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=1650&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=7ba00a60cb18760b03f96901038bb862 1650w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/kb_hybrid_search.jpg?w=2500&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=84f391e70a6487b61fdc928aa258f0a1 2500w" />
</p>

When a user submits a query, it is simultaneously routed through two parallel search mechanisms: an embedding-based semantic search (left) and a full-text keyword search (right).

Below is a breakdown of how hybrid search works under the hood:

* **Semantic Search** (path on the left)

  It takes place in parallel with the keyword search. Semantic search starts by embedding the search query and searching against the content of the knowledge base. This results in a set of relevant documents found.

* **Keyword Search** (path on the right)

  It takes place in parallel with the semantic search. The system performs a keyword-based search, using one or more keywords provided in the search query, over the content of the knowledge base. To ensure performance, especially at scale, when dealing with millions of documents, we rely on a full-text indexing system.

  This index is typically built as an inverted index, mapping keywords to the documents in which they appear. It allows for efficient lookups and rapid retrieval of all entries that contain the given terms.

  <Note>
    Storage of Full-Text Index

    Just as embeddings are stored to support semantic similarity search, a full-text index must also be stored to enable efficient keyword-based retrieval. This index serves as the foundation for fast and scalable full-text search and is tightly integrated with the knowledge base.

    Each knowledge base maintains its own dedicated full-text index, built and updated as documents are ingested or modified. Maintaining this index alongside the stored embeddings ensures that both semantic and keyword search capabilities are always available and performant, forming the backbone of hybrid search.
  </Note>

  This step ensures that exact matches, like specific acronyms, ticket numbers, or product identifiers, can be found quickly, even if the semantic model wouldn’t have surfaced them.

* **Combining Results**

  At this step, results from both searches are merged. Semantic search returned documents similar in meaning to the user’s query using embeddings, while keyword search returned documents containing the keywords extracted from the user’s query. This complete result set is passed to the reranker.

* **Reranking**

  The results are reranked, considering relevance scores from both search types, and ordered accordingly.

  There are two mechanisms for reranking the results:

  * Using the reranking model of the knowledge base

    If the knowledge base was created with the reranking model provided, the hybrid search uses it to rerank the result set.

    ```sql
    SELECT * from my_kb
    WHERE
        content = ”ACME-213”
        AND hybrid_search = true;
    ```

    In this query, the hybrid search uses the reranking features enabled with the knowledge base.

  * Using the alpha reranking that can be further customized for hybrid search

    Users can opt for using the alpha reranking that can be customized specifically for hybrid search. By setting the `hybrid_search_alpha` parameter to any value between 0 and 1, users can give importance to results from the keyword search (if the value is closer to 0) or the semantic search (if the value is closer to 1).

    ```sql
    SELECT * from my_kb
    WHERE
        content = ”ACME-213”
        AND hybrid_search = true;
        AND hybrid_search_alpha = 0.4
        AND reranking = false;
    ```

    This query uses hybrid search with emphasis on results from the keyword search.

    <Note>
      Relevance-Based Document Selection for Reranking

      When retrieving documents from the full-text index, there is a practical limit on how many documents can be passed to the reranker, since reranking is typically computationally expensive. To ensure that only the most promising candidates are selected for reranking, we apply relevance heuristics during the keyword search stage.

      One widely used heuristic is BM25, a ranking function that scores documents based on their keyword relevance to the user query. BM25 considers both the frequency of a keyword within a document and how common that keyword is across the entire corpus.

      By scoring documents using BM25, the system can prioritize more relevant matches and limit reranker input to a smaller, high-quality subset of documents. This helps achieve a balance between performance and retrieval accuracy in hybrid search.
    </Note>

  Overall, the reranker ensures that highly relevant keyword matches appear alongside semantically similar results, offering users a balanced and accurate response.

# How to Evaluate Knowledge Bases

Evaluating knowledge bases verifies how accurate and relevant is the data returned by the knowledge base.

## `EVALUATE KNOWLEDGE_BASE` Syntax

With the `EVALUATE KNOWLEDGE_BASE` command, users can evaluate the relevancy and accuracy of the documents and data returned by the knowledge base.

Below is the complete syntax that includes both required and optional parameters.

```sql
EVALUATE KNOWLEDGE_BASE my_kb
USING
    test_table = my_datasource.my_test_table,
    version = 'doc_id',
    generate_data = {
        'from_sql': 'SELECT id, content FROM my_datasource.my_table',
        'count': 100
    }, 
    evaluate = false,
    llm = {
        'provider': 'openai',
        'api_key':'sk-xxx',
        'model_name':'gpt-4'
    },
    save_to = my_datasource.my_result_table; 
```

### `test_table`

This is a required parameter that stores the name of the table from one of the data sources connected to MindsDB. For example, `test_table = my_datasource.my_test_table` defines a table named `my_test_table` from a data source named `my_datasource`.

This test table stores test data commonly in form of questions and answers. Its content depends on the `version` parameter defined below.

Users can provide their own test data or have the test data generated by the `EVALUATE KNOWLEDGE_BASE` command, which is performed when setting the `generate_data` parameter defined below.

### `version`

This is an optional parameter that defines the version of the evaluator. If not defined, its default value is `doc_id`.

* `version = 'doc_id'`
  The evaluator checks whether the document ID returned by the knowledge base matched the expected document ID as defined in the test table.

* `version = 'llm_relevancy'`
  The evaluator uses a language model to rank and evaluate responses from the knowledge base.

### `generate_data`

This is an optional parameter used to configure the test data generation, which is saved into the table defined in the `test_table` parameter. If not defined, its default value is `false`, meaning that no test data is generated.

Available values are as follows:

* A dictionary containing the following values:

  * `from_sql` defines the SQL query that fetches the test data. For example, `'from_sql': 'SELECT id, content FROM my_datasource.my_table'`. If not defined, it fetches test data from the knowledge base on which the `EVALUATE` command is executed: `SELECT chunk_content, id FROM my_kb`.
  * `count` defines the size of the test dataset. For example, `'count': 100`. Its default value is 20.

  <Note>
    When providing the `from_sql` parameter, it requires specific column names as follows:

    * With `version = 'doc_id'`, the `from_sql` parameter should contain a query that returns the `id` and `content` columns, like this: `'from_sql': 'SELECT id_column_name AS id, content_column_names AS content FROM my_datasource.my_table'`

    * With `version = 'llm_relevancy'`, the `from_sql` parameter should contain a query that returns the `content` column, like this: `'from_sql': 'SELECT content_column_names AS content FROM my_datasource.my_table'`
  </Note>

* A value of `true`, such as `generate_data = true`, which implies that default values for `from_sql` and `count` will be used.

### `evaluate`

This is an optional parameter that defines whether to evaluate the knowledge base. If not defined, its default value is `true`.

Users can opt for setting it to false, `evaluate = false`, in order to generate test data into the test table without running the evaluator.

### `llm`

This is an optional parameter that defines a language model to be used for evaluations, if `version` is set to `llm_relevancy`.

If not defined, its default value is the [`reranking_model` defined with the knowledge base](/mindsdb_sql/knowledge_bases/create#reranking-model).

Users can define it with the `EVALUATE KNOWLEDGE_BASE` command in the same manner.

```sql
EVALUATE KNOWLEDGE_BASE my_kb
USING
    ...
    llm = {
        "provider": "azure_openai",
        "model_name" : "gpt-4o",
        "api_key": "sk-abc123",
        "base_url": "https://ai-6689.openai.azure.com/",
        "api_version": "2024-02-01",
        "method": "multi-class"
    },
    ...
```

### `save_to`

This is an optional parameter that stores the name of the table from one of the data sources connected to MindsDB. For example, `save_to = my_datasource.my_result_table` defines a table named `my_result_table` from the data source named `my_datasource`. If not defined, the results are not saved into a table.

This table is used to save the evaluation results.

By default, evaluation results are returned after executing the `EVALUATE KNOWLEDGE_BASE` statement.

### Evaluation Results

When using `version = 'doc_id'`, the following columns are included in the evaluation results:

* `total` stores the total number of questions.
* `total_found` stores the number of questions to which the knowledge bases provided correct answers.
* `retrieved_in_top_10` stores the number of top 10 questions to which the knowledge bases provided correct answers.
* `cumulative_recall` stores data that can be used to create a chart.
* `avg_query_time` stores the execution time of a search query of the knowledge base.
* `name` stores the knowledge base name.
* `created_at` stores the timestamp when the evaluation was created.

When using `version = 'llm_relevancy'`, the following columns are included in the evaluation results:

* `avg_relevancy` stores the average relevancy.
* `avg_relevance_score_by_k` stores the average relevancy at k.
* `avg_first_relevant_position` stores the average first relevant position.
* `mean_mrr` stores the Mean Reciprocal Rank (MRR).
* `hit_at_k` stores the Hit\@k value.
* `bin_precision_at_k` stores the Binary Precision\@k.
* `avg_entropy` stores the average relevance score entropy.
* `avg_ndcg` stores the average nDCG.
* `avg_query_time` stores the execution time of a search query of the knowledge base.
* `name` stores the knowledge base name.
* `created_at` stores the timestamp when the evaluation was created.

# How to Use Knowledge Bases

This section contains examples of usage of knowledge bases.

### Sales Data

Here is the data that will be inserted into the knowledge base.

```sql
+----------+-------------------+------------------------+
| order_id | product           | notes                  |
+----------+-------------------+------------------------+
| A1B      | Wireless Mouse    | Request color: black   |
| 3XZ      | Bluetooth Speaker | Gift wrap requested    |
| Q7P      | Laptop Stand      | Prefer aluminum finish |
+----------+-------------------+------------------------+
```

You can access this sample data as below:

```sql
CREATE DATABASE sample_data
WITH ENGINE = 'postgres',
PARAMETERS = {
    "user": "demo_user",
    "password": "demo_password",
    "host": "samples.mindsdb.com",
    "port": "5432",
    "database": "demo",
    "schema": "demo_data"
};

SELECT * FROM sample_data.orders;
```

Here is how to create a knowledge base specifically for the data.

```sql
CREATE KNOWLEDGE_BASE my_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-abc123"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-abc123"
    },
    metadata_columns = ['product'],
    content_columns = ['notes'],
    id_column = 'order_id';
```

Here is how to insert the data.

```sql
INSERT INTO my_kb
SELECT order_id, product, notes
FROM sample_data.orders;
```

Here is how to query the knowledge base.

```sql
SELECT *
FROM my_kb
WHERE product = 'Wireless Mouse'
AND content = 'color'
AND relevance > 0.5;
```

### Financial Data

You can access the sample data as below:

```sql
CREATE DATABASE sample_data
WITH ENGINE = 'postgres',
PARAMETERS = {
    "user": "demo_user",
    "password": "demo_password",
    "host": "samples.mindsdb.com",
    "port": "5432",
    "database": "demo",
    "schema": "demo_data"
};

SELECT * FROM sample_data.financial_headlines;
```

Here is how to create a knowledge base specifically for the data.

```sql
CREATE KNOWLEDGE_BASE my_kb
USING
    embedding_model = {
        "provider": "openai",
        "model_name" : "text-embedding-3-large",
        "api_key": "sk-xxx"
    },
    reranking_model = {
        "provider": "openai",
        "model_name": "gpt-4o",
        "api_key": "sk-xxx"
    },
    metadata_columns = ['sentiment_labelled'],
    content_columns = ['headline'];
```

Here is how to insert the data.

```sql
INSERT INTO my_kb
SELECT *
FROM sample_data.financial_headlines
USING
    batch_size = 500,
    threads = 10;
```

Here is how to query the knowledge base.

* Query without defined `LIMIT`

```sql
SELECT *
FROM my_kb
WHERE content = 'investors';
```

This query returns 10 rows, as the default `LIMIT` is set to 10.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=bd67ed9ebff5125ffa23b6570cf89ad9" data-og-width="1600" width="1600" data-og-height="779" height="779" data-path="assets/sql/kb_retrieval_example1.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=93deb0499ec4b6c1005719873061b86c 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=4efa81b64dde0821710e78ee54f374a3 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=112614191368419fe78b184d9eaf8c14 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=8d14fe398c8604e7325c9bbfd149bde6 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=36f8cade37d31d4770a1e2a2d3552db8 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example1.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=3c1eb60a4475a1363653a8904d67332e 2500w" />
</p>

* Query with defined `LIMIT`

```sql
SELECT *
FROM my_kb
WHERE content = 'investors'
LIMIT 20;
```

This query returns 20 rows, as the user-defined `LIMIT` is set to 20.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=0f0cff93b9fef5ec4b1379c668c1305b" data-og-width="1600" width="1600" data-og-height="813" height="813" data-path="assets/sql/kb_retrieval_example2.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=0da2e68141d4aa997065fcd40ce5b6f8 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=0f9d7de37e52b4dd608df58a5ae5b2b3 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=857fb38f27ba44d7b84c4780a7788c6f 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=d65549d3a7ad26f7f8d7d87ea1df6212 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=dd0ae3367ef7174b5f7bd6381a224185 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example2.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=87514eb0698c28af32d332abe8e97a7d 2500w" />
</p>

* Query with defined `LIMIT` and `relevance`

```sql
SELECT *
FROM my_kb
WHERE content = 'investors'
AND relevance >= 0.8
LIMIT 20;
```

This query may return 20 or less rows, depending on whether the relevance scores of the rows match the user-defined condition.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=900085ad0403c605adc70f4d8a0c8745" data-og-width="1600" width="1600" data-og-height="843" height="843" data-path="assets/sql/kb_retrieval_example3.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=c9a42a67c51b1bc00827e7116cfd00b7 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=15767997ad7ec49bf8d82ca2bd91ab6c 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=ac64be15fd336ce8525a2366e4ccf7a5 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=8169c8a962a3cb812f11a24f0051f838 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=e710f5f5c6d3a4e33bf040e00cb5c351 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/kb_retrieval_example3.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=78b20318a9892976033e2edb505f3d34 2500w" />
</p>

# Create a Table

## Description

The `CREATE TABLE` statement creates a table and optionally fills it with data from provided query. It may be used to materialize prediction results as tables.

## Syntax

You can use the `CREATE TABLE` statement to create an empty table:

```sql
CREATE TABLE integration_name.table_name (
  column_name data_type,
  ...
);
```

You can use the `CREATE TABLE` statement to create a table and fill it with data:

```sql
CREATE TABLE integration_name.table_name
    (SELECT ...);
```

Or the `CREATE OR REPLACE TABLE` statement:

```sql
CREATE OR REPLACE TABLE integration_name.table_name
    (SELECT ...);
```

Here is how to list tables from a connected data source:

```sql
SHOW TABLES FROM data_source_name;
```

<Note>
  Note that the `integration_name` connection must be created with the [`CREATE DATABASE`](/mindsdb_sql/sql/create/database) statement and the user with write access.
</Note>

Here are the steps followed by the syntax:

* It executes a subselect query to get the output data.
* In the case of the `CREATE OR REPLACE TABLE` statement, the
  `integration_name.table_name` table is dropped before recreating it.
* It (re)creates the `integration_name.table_name` table inside the
  `integration_name` integration.
* It uses the [`INSERT INTO`](/sql/api/insert/) statement to insert the
  output of the `(SELECT ...)` query into the
  `integration_name.table_name`.

## Example

We want to save the prediction results into the `int1.tbl1` table.

Here is the schema structure used throughout this example:

```bash
int1
└── tbl1
mindsdb
└── predictor_name
int2
└── tbl2
```

Where:

| Name             | Description                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- |
| `int1`           | Integration where the table that stores prediction results resides.                   |
| `tbl1`           | Table that stores prediction results.                                                 |
| `predictor_name` | Name of the model.                                                                    |
| `int2`           | Integration where the data source table used in the inner `SELECT` statement resides. |
| `tbl2`           | Data source table used in the inner `SELECT` statement.                               |

Let's execute the query.

```sql
CREATE OR REPLACE TABLE int1.tbl1 (
    SELECT *
    FROM int2.tbl2 AS ta
    JOIN mindsdb.predictor_name AS tb
    WHERE ta.date > '2015-12-31'
);
```

# Remove a Table

## Description

The `DROP TABLE` statement deletes a table or a file.

<Warning>
  Please note that this feature is not yet implemented for tables from connected data sources.
</Warning>

## Syntax

Here is the syntax:

```sql
DROP TABLE table_name;
```

And for files:

```sql
DROP TABLE files.file_name;
```

On execution, we get:

```sql
Query successfully completed
```

<Note>
  Please note that the uploaded files are tables as well. So to remove an uploaded file, use this `DROP TABLE` statement.
</Note>

# Query a Table

## Description

The `SELECT` statement fetches data from a table and predictions from a model.

Here we go over example of selecting data from tables of connected data sources. To learn how to select predictions from a model, visit [this page](/sql/api/select-predictions).

## Syntax

## Simple SELECT FROM an integration

In this example, query contains only tables from one integration. This query will be executed on this integration database (where integration name will be cut from the table name).

```sql
SELECT location, max(sqft)
FROM example_db.demo_data.home_rentals 
GROUP BY location
LIMIT 5;
```

## Raw SELECT FROM an integration

It is also possible to send [native queries](/sql/native-queries) to integration that use syntax native to a given integration. It is useful when a query can not be parsed as SQL.

```sql
SELECT ... FROM integration_name ( native query goes here );
```

Here is an example of selecting from a Mongo integration using Mongo-QL syntax:

```sql
SELECT * FROM mongo (
 db.house_sales2.find().limit(1) 
);
```

## Complex queries

1. Subselect on data from integration.

It can be useful in cases when integration engine doesn't support some functions, for example, grouping, as shown below. In this case, all data from raw select are passed to MindsDB and then subselect performs operations on them inside MindsDB.

```sql
SELECT type, max(bedrooms), last(MA)
FROM mongo (
 db.house_sales2.find().limit(300) 
) GROUP BY 1
```

2. Unions

It is possible to use `UNION` and `UNION ALL` operators. It this case, every subselect from union will be fetched and merged to one result-set on MindsDB side.

```sql
 SELECT data.time as date, data.target
 FROM datasource.table_name as data

UNION ALL

 SELECT model.time as date, model.target as target
 FROM mindsdb.model as model 
  JOIN datasource.table_name as t
 WHERE t.time > LATEST AND t.group = 'value';
```

# Native Queries

The underlying database engine of MindsDB is MySQL. However, you can run queries native to your database engine within MindsDB.

## Connect your Database to MindsDB

To run queries native to your database, you must first connect your database to MindsDB using the `CREATE DATABASE` statement.

```sql
CREATE DATABASE example_db
WITH ENGINE = "postgres",
PARAMETERS = {
    "user": "demo_user",
    "password": "demo_password",
    "host": "samples.mindsdb.com",
    "port": "5432",
    "database": "demo"
};
```

Here we connect the `example_db` database, which is a PostgreSQL database.

## Run Queries Native to your Database

Once we have our PostgreSQL database connected, we can run PostgreSQL-native queries.

### Querying

To run PostgreSQL-native code, we must nest it within the `SELECT` statement like this:

```sql
SELECT * FROM example_db (
    SELECT 
        model, 
        year, 
        price, 
        transmission, 
        mileage, 
        fueltype, 
        mpg, -- miles per galon
        ROUND(CAST((mpg / 2.3521458) AS numeric), 1) AS kml, -- kilometers per liter
        (date_part('year', CURRENT_DATE)-year) AS years_old, -- age of a car
        COUNT(*) OVER (PARTITION BY model, year) AS units_to_sell, -- how many units of a certain model are sold in a year
        ROUND((CAST(tax AS decimal) / price), 3) AS tax_div_price -- value of tax divided by price of a car
    FROM demo_data.used_car_price
);
```

On execution, we get:

```sql
+-----+----+-----+------------+-------+--------+----+----+---------+-------------+-------------+
|model|year|price|transmission|mileage|fueltype|mpg |kml |years_old|units_to_sell|tax_div_price|
+-----+----+-----+------------+-------+--------+----+----+---------+-------------+-------------+
| A1  |2010|9990 |Automatic   |38000  |Petrol  |53.3|22.7|12       |1            |0.013        |
| A1  |2011|6995 |Manual      |65000  |Petrol  |53.3|22.7|11       |5            |0.018        |
| A1  |2011|6295 |Manual      |107000 |Petrol  |53.3|22.7|11       |5            |0.02         |
| A1  |2011|4250 |Manual      |116000 |Diesel  |70.6|30  |11       |5            |0.005        |
| A1  |2011|6475 |Manual      |45000  |Diesel  |70.6|30  |11       |5            |0            |
+-----+----+-----+------------+-------+--------+----+----+---------+-------------+-------------+
```

The first line (`SELECT * FROM example_db`) informs MindsDB that we select from a PostgreSQL database. After that, we nest a PostgreSQL code within brackets.

### Creating Views

We can create a view based on a native query.

```sql
CREATE VIEW cars FROM example_db (
        SELECT 
            model, 
            year, 
            price, 
            transmission, 
            mileage, 
            fueltype, 
            mpg, -- miles per galon
            ROUND(CAST((mpg / 2.3521458) AS numeric), 1) AS kml, -- kilometers per liter
            (date_part('year', CURRENT_DATE)-year) AS years_old, -- age of a car
            COUNT(*) OVER (PARTITION BY model, year) AS units_to_sell, -- how many units of a certain model are sold in a year
            ROUND((CAST(tax AS decimal) / price), 3) AS tax_div_price -- value of tax divided by price of a car
        FROM demo_data.used_car_price
);
```

On execution, we get:

```sql
Query OK, 0 rows affected (x.xxx sec)
```
# Update a Table

## Description

MindsDB provides two ways of using the `UPDATE` statement:

1. The regular `UPDATE` statement updates specific column values in an existing table.

2. The `UPDATE FROM SELECT` statement updates data in an existing table from a subselect query. It can be used as an alternative to `CREATE TABLE` or `INSERT INTO` to store predictions.

## Syntax

Here is an example of the regular `UPDATE` statement:

```sql
UPDATE integration_name.table_name
SET column_name = new_value
WHERE column_name = old_value
```

<Info>
  Please replace the placeholders as follows:

  * `integration_name` is the name of the connected data source.
  * `table_name` is the table name within that data source.
  * `column_name` is the column name within that table.
</Info>

And here is an example of the `UPDATE FROM SELECT` statement that updates a table with predictions made within MindsDB:

```sql
UPDATE
    integration_to_be_updated.table_to_be_updated
SET
    column_to_be_updated = prediction_data.predicted_value_column,
FROM 
    (
        SELECT p.predicted_value_column, p.column1, p.column2
        FROM integration_name.table_name as t
        JOIN model_name as p
    ) AS prediction_data
WHERE
    column1 = prediction_data.column1
    AND column2 = prediction_data.column2
```

Below is an alternative for the `UPDATE FROM SELECT` statement that updates a table with predictions. This syntax is easier to write.

```sql
UPDATE
    integration_to_be_updated.table_to_be_updated
ON 
    column1, column2
FROM 
    (
        SELECT p.predicted_value_column as column_to_be_updated, p.column1, p.column2
        FROM integration_name.table_name as t
        JOIN model_name as p
    ) 
```

<Info>
  The steps followed by the syntax:

  * It executes query from the `FROM` clause to get the output data. In our example, we query for predictions, but it could be a simple select from another table. Please note that it is aliased as `prediction_data`.
  * It updates all rows from the `table_to_be_updated` table (that belongs to the `integration_to_be_updated` integration) that match the `WHERE` clause criteria. The rows are updated with values as defined in the `SET` clause.
</Info>

<Tip>
  It is recommended to use the primary key column(s) in the WHERE clause (here, `column1` and `column2`), as the primary key column(s) uniquely identify each row. Otherwise, the `UPDATE` statement may lead to unexpected results by altering rows that you didn't want to affect.
</Tip>

# Insert Into a Table

## Description

The `INSERT INTO` statement inserts data into a table. The data comes from a subselect query. It is commonly used to input prediction results into a database table.

## Syntax

Here is the syntax:

```sql
INSERT INTO integration_name.table_name
    (SELECT ...);
```

Please note that the destination table (`integration_name.table_name`) must
exist and contain all the columns where the data is to be inserted.

And the steps followed by the syntax:

* It executes a subselect query to get the output dataset.
* It uses the `INSERT INTO` statement to insert the output of the
  `(SELECT ...)` query into the `integration_name.table_name` table.

On execution, we get:

```sql
Query OK, 0 row(s) updated - x.xxxs
```

### Example

We want to save the prediction results into the `int1.tbl1` table.

Here is the schema structure used throughout this example:

```bash
int1
└── tbl1
mindsdb
└── predictor_name
int2
└── tbl2
```

Where:

| Name             | Description                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- |
| `int1`           | Integration where the table that stores prediction results resides.                   |
| `tbl1`           | Table that stores prediction results.                                                 |
| `predictor_name` | Name of the model.                                                                    |
| `int2`           | Integration where the data source table used in the inner `SELECT` statement resides. |
| `tbl2`           | Data source table used in the inner `SELECT` statement.                               |

Let's execute the query.

```sql
INSERT INTO int1.tbl1 (
    SELECT *
    FROM int2.tbl2 AS ta
    JOIN mindsdb.predictor_name AS tb
    WHERE ta.date > '2015-12-31'
);
```

On execution, we get:

```sql
Query OK, 0 row(s) updated - x.xxxs
```

# Join Tables On

## Description

The `JOIN` statement combines two or more tables based `ON` a specified column(s). It functions as a standard `JOIN` in SQL while offering the added capability of **combining data from multiple data sources**, allowing users to join data from one or more data sources seamlessly.

## Syntax

Here is the syntax:

```sql
SELECT t1.column_name, t2.column_name, t3.column_name
FROM datasource1.table1 [AS] t1
JOIN datasource2.table2 [AS] t2
ON t1.column_name = t2.column_name
JOIN datasource3.table3 [AS] t3
ON t1.column_name = t3.column_name;
```

This query joins data from three different datasources - `datasource1`, `datasource2`, and `datasource3` - allowing users to execute federated queries accross multiple data sources.

<Tip>
  **Nested `JOINs`**

  MindsDB provides you with two categories of `JOINs`. One is [the `JOIN` statement which combines the data table with the model table](/mindsdb_sql/sql/api/join) in order to fetch bulk predictions. Another is the regular `JOIN` used throughout SQL, which requires the `ON` clause.

  You can nest these types of `JOINs` as follows:

  ```sql
  SELECT * FROM (
      SELECT *
      FROM project_name.model_table AS m
      JOIN datasource_name.data_table AS d;
  ) AS t1
  JOIN (
      SELECT *
      FROM project_name.model_table AS m
      JOIN datasource_name.data_table AS d;
  ) AS t2
  ON t1.column_name = t2.column_name;
  ```
</Tip>

## Example 1

Let's use the following data to see how the different types of `JOINs` work.

The `pets` table that stores pets:

```sql
+------+-------+
|pet_id|name   |
+------+-------+
|1     |Moon   |
|2     |Ripley |
|3     |Bonkers|
|4     |Star   |
|5     |Luna   |
|6     |Lake   |
+------+-------+
```

And the `owners` table that stores pets' owners:

```sql
+--------+-------+------+
|owner_id|name   |pet_id|
+--------+-------+------+
|1       |Amy    |4     |
|2       |Bob    |1     |
|3       |Harry  |5     |
|4       |Julia  |2     |
|5       |Larry  |3     |
|6       |Henry  |0     |
+--------+-------+------+
```

### `JOIN` or `INNER JOIN`

The `JOIN` or `INNER JOIN` command joins the rows of the `owners` and `pets` tables wherever there is a match. For example, a pet named Lake does not have an owner, so it'll be left out.

```sql
SELECT *
FROM files.owners o
[INNER] JOIN files.pets p
ON o.pet_id = p.pet_id;
```

On execution, we get:

```sql
+--------+-------+------+------+-------+
|owner_id|name   |pet_id|pet_id|name   |
+--------+-------+------+------+-------+
|1       |Amy    |4     |4     |Star   |
|2       |Bob    |1     |1     |Moon   |
|3       |Harry  |5     |5     |Luna   |
|4       |Julia  |2     |2     |Ripley |
|5       |Larry  |3     |3     |Bonkers|
+--------+-------+------+------+-------+
```

As in standard SQL, you can use the `WHERE` clause to filter the output data.

```sql
SELECT *
FROM files.owners o
[INNER] JOIN files.pets p
ON o.pet_id = p.pet_id
WHERE o.name = 'Amy'
OR o.name = 'Bob';
```

On execution, we get:

```sql
+--------+-------+------+------+-------+
|owner_id|name   |pet_id|pet_id|name   |
+--------+-------+------+------+-------+
|1       |Amy    |4     |4     |Star   |
|2       |Bob    |1     |1     |Moon   |
+--------+-------+------+------+-------+
```

### `LEFT JOIN`

The `LEFT JOIN` command joins the rows of two tables such that all rows from the left table, even the ones with no match, show up. Here, the left table is the `owners` table.

```sql
SELECT *
FROM files.owners o
LEFT JOIN files.pets p
ON o.pet_id = p.pet_id;
```

On execution, we get:

```sql
+--------+-------+------+------+-------+
|owner_id|name   |pet_id|pet_id|name   |
+--------+-------+------+------+-------+
|1       |Amy    |4     |4     |Star   |
|2       |Bob    |1     |1     |Moon   |
|3       |Harry  |5     |5     |Luna   |
|4       |Julia  |2     |2     |Ripley |
|5       |Larry  |3     |3     |Bonkers|
|6       |Henry  |0     |[NULL]|[NULL] |
+--------+-------+------+------+-------+
```

### `RIGHT JOIN`

The `RIGHT JOIN` command joins the rows of two tables such that all rows from the right table, even the ones with no match, show up. Here, the right table is the `pets` table.

```sql
SELECT *
FROM files.owners o
RIGHT JOIN files.pets p
ON o.pet_id = p.pet_id;
```

On execution, we get:

```sql
+--------+-------+------+------+-------+
|owner_id|name   |pet_id|pet_id|name   |
+--------+-------+------+------+-------+
|2       |Bob    |1     |1     |Moon   |
|4       |Julia  |2     |2     |Ripley |
|5       |Larry  |3     |3     |Bonkers|
|1       |Amy    |4     |4     |Star   |
|3       |Harry  |5     |5     |Luna   |
|[NULL]  |[NULL] |[NULL]|6     |Lake   |
+--------+-------+------+------+-------+
```

### `FULL JOIN` or `FULL OUTER JOIN`

The `FULL [OUTER] JOIN` command joins the rows of two tables such that all rows from both tables, even the ones with no match, show up.

```sql
SELECT *
FROM files.owners o
FULL [OUTER] JOIN files.pets p
ON o.pet_id = p.pet_id;
```

On execution, we get:

```sql
+--------+------+------+------+-------+---------+
|owner_id|name  |pet_id|pet_id|name   |animal_id|
+--------+------+------+------+-------+---------+
|1       |Amy   |4     |4     |Star   |2        |
|2       |Bob   |1     |1     |Moon   |1        |
|3       |Harry |5     |5     |Luna   |2        |
|4       |Julia |2     |2     |Ripley |1        |
|5       |Larry |3     |3     |Bonkers|3        |
|6       |Henry |0     |[NULL]|[NULL] |[NULL]   |
|[NULL]  |[NULL]|[NULL]|6     |Lake   |4        |
+--------+------+------+------+-------+---------+
```

## Example 2

More than two tables can be joined subsequently.

Let's use another table called `animals`:

```sql
+---------+-------+
|animal_id|name   |
+---------+-------+
|1        |Dog    |
|2        |Cat    |
|3        |Hamster|
|4        |Fish   |
+---------+-------+
```

Now we can join all three tables.

```sql
SELECT *
FROM files.owners o
RIGHT JOIN files.pets p ON o.pet_id = p.pet_id
JOIN files.animals a ON p.animal_id = a.animal_id;
```

On execution, we get:

```sql
+--------+-------+------+------+-------+---------+---------+-------+
|owner_id|name   |pet_id|pet_id|name   |animal_id|animal_id|name   |
+--------+-------+------+------+-------+---------+---------+-------+
|2       |Bob    |1     |1     |Moon   |1        |1        |Dog    |
|4       |Julia  |2     |2     |Ripley |1        |1        |Dog    |
|5       |Larry  |3     |3     |Bonkers|3        |3        |Hamster|
|1       |Amy    |4     |4     |Star   |2        |2        |Cat    |
|3       |Harry  |5     |5     |Luna   |2        |2        |Cat    |
|[NULL]  |[NULL] |[NULL]|6     |Lake   |4        |4        |Fish   |
+--------+-------+------+------+-------+---------+---------+-------+
```

# Delete From a Table

## Description

The `DELETE` statement removes rows that fulfill the `WHERE` clause criteria.

## Syntax

Here is the syntax:

```sql
DELETE FROM integration_name.table_name
WHERE column_name = column_value_to_be_removed;
```

This statement removes all rows from the `table_name` table (that belongs to the `integration_name` integration) wherever the `column_name` column value is equal to `column_value_to_be_removed`.

And here is another way to filter the rows using a subquery:

```sql
DELETE FROM integration_name.table_name
WHERE column_name IN
                    (
                        SELECT column_value_to_be_removed
                        FROM some_integration.some_table
                        WHERE some_column = some_value
                    );
```

This statement removes all rows from the `table_name` table (that belongs to the `integration_name` integration) wherever the `column_name` column value is equal to one of the values returned by the subquery.

# Create a View

## Description

The `CREATE VIEW` statement creates a view, which is a great way to do data preparation in MindsDB. A VIEW is a saved `SELECT` statement, which is executed every time we call this view.

## Syntax

Here is the syntax:

```sql
CREATE VIEW [IF NOT EXISTS] project_name.view_name AS (
    SELECT columns
    FROM integration_name.table_name AS a
    JOIN integration_name.table_name AS p ON a.id = p.id
    JOIN ...
);
```

Here is how to list all views:

```sql
SHOW VIEWS;
```

# Remove a View

## Description

The `DROP VIEW` statement deletes the view.

## Syntax

Here is the syntax:

```sql
DROP VIEW [IF EXISTS] view_name;
```

On execution, we get:

```sql
Query successfully completed
```

# Query a View

## Description

The `SELECT` statement fetches data from a view that resides inside a project.

## Syntax

Here is the syntax:

```sql
SELECT *
FROM project_name.view_name;
```

# Alter a View

## Description

The `ALTER VIEW` statement updates the query assigned to a view created with the [`CREATE VIEW` command](/mindsdb_sql/sql/create/view).

## Syntax

Here is the syntax:

```sql
ALTER VIEW view_name [AS] (
    SELECT * FROM integration_name.table_name
);

--or

ALTER VIEW name 
FROM integration_name (
    SELECT * FROM table_name
);
```

# Upload a File

Follow the steps below to upload a file to MindsDB.

<Note>
  Note that the trailing whitespaces on column names are erased upon uploading a file to MindsDB.
</Note>

1. Access the MindsDB Editor.

2. Open the `Add` menu and choose `Upload file`.

   <p align="center">
     <img src="https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=21362d030edc1ae248b29a715f87a234" data-og-width="808" width="808" data-og-height="572" height="572" data-path="assets/sql/upload_file1.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=280&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=6b593f2016279cab7150f0870538b091 280w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=560&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=680d1862f944cab7b676fe150c9119fb 560w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=840&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=bcea866b9a3bd8e7f3587f8ca1380eeb 840w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=1100&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=6f0bf5c98247e0e8d48d7860424cc41b 1100w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=1650&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=21a217331d9aac8890a32d202ceb9f12 1650w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file1.png?w=2500&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=6c040fff83dfbec45d2c1aef37f0c216 2500w" />
   </p>

3. Select a file, provide its name, and click on `Save & Continue`.

   <p align="center">
     <img src="https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=fefc4308a76712cf4e34ffa33e459eb8" data-og-width="960" width="960" data-og-height="988" height="988" data-path="assets/sql/upload_file2.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=280&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=1be561b64b1abdf48268687e2ad00892 280w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=560&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=e6f9f040aafbbbdecca9b2ddf31be4aa 560w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=840&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=5cb57b8dd32c8d577dbd7b1f692d406d 840w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=1100&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=286a94692ff7cd8da8e00b6293240f27 1100w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=1650&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=7ac16bde920656a5058313750f575afb 1650w, https://mintcdn.com/mindsdb/2W3ufVC_5_fCv4ZW/assets/sql/upload_file2.png?w=2500&fit=max&auto=format&n=2W3ufVC_5_fCv4ZW&q=85&s=280647ee1c894091a9b13d0458a90b3f 2500w" />
   </p>

4. Now you can query the file.

   ```sql
   SELECT * FROM files.file_name;
   ```

Here is how to list all files:

```sql
SHOW TABLES FROM files;
```

This command is the same as the command for listing tables because files uploaded to MindsDB become tables within the MindsDB ecosystem and are stored in the `files` database.

### Configuring URL File Upload for Specific Domains

The File Uploader can be configured to interact only with specific domains by using the [`url_file_upload` key in `config.json` file](/setup/custom-config#url-file-upload).
This feature allows you to restrict the handler to upoad and process files only from the domains you specify, enhancing security and control over web interactions.

To configure this, simply list the allowed domains under the [`url_file_upload` key in `config.json` file](/setup/custom-config#url-file-upload).

## What's Next?

Now, you are ready to create a predictor from a file. Make sure to check out
[this guide](/sql/create/model/)
on how to do that.

# Remove a File

## Description

The `DROP TABLE` statement is also used to delete a file.

## Syntax

Here is the syntax:

```sql
DROP TABLE files.file_name;
```

On execution, we get:

```sql
Query successfully completed
```

<Note>
  Please note that the uploaded files are tables as well. So to remove an uploaded file, use this `DROP TABLE` statement.
</Note>

# Query a File

## Description

The `SELECT * FROM files.file_name` statement is used to select data from a file.

First, you upload a file to the MindsDB Editor by following
[this guide](/sql/create/file/). And then, you can
[`CREATE MODEL`](/sql/create/model) from the uploaded file.

## Syntax

Here is the syntax:

```sql
SELECT *
FROM files.file_name;
```

On execution, we get:

```sql
+--------+--------+--------+--------+
| column | column | column | column |
+--------+--------+--------+--------+
| value  | value  | value  | value  |
+--------+--------+--------+--------+
```

Where:

| Name        | Description                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| `file_name` | Name of the file uploaded to the MindsDB Editor by following [this guide](/sql/create/file/). |
| `column`    | Name of the column from the file.                                                             |

## Example

Once you uploaded your file by following [this guide](/sql/create/file/), you
can query it like a table.

```sql
SELECT *
FROM files.home_rentals
LIMIT 10;
```

On execution, we get:

```sql
+-----------------+---------------------+-------+----------+----------------+---------------+--------------+--------------+
| number_of_rooms | number_of_bathrooms | sqft  | location | days_on_market | initial_price | neighborhood | rental_price |
+-----------------+---------------------+-------+----------+----------------+---------------+--------------+--------------+
| 0               | 1                   | 484,8 | great    | 10             | 2271          | south_side   | 2271         |
| 1               | 1                   | 674   | good     | 1              | 2167          | downtown     | 2167         |
| 1               | 1                   | 554   | poor     | 19             | 1883          | westbrae     | 1883         |
| 0               | 1                   | 529   | great    | 3              | 2431          | south_side   | 2431         |
| 3               | 2                   | 1219  | great    | 3              | 5510          | south_side   | 5510         |
| 1               | 1                   | 398   | great    | 11             | 2272          | south_side   | 2272         |
| 3               | 2                   | 1190  | poor     | 58             | 4463          | westbrae     | 4123.812     |
| 1               | 1                   | 730   | good     | 0              | 2224          | downtown     | 2224         |
| 0               | 1                   | 298   | great    | 9              | 2104          | south_side   | 2104         |
| 2               | 1                   | 878   | great    | 8              | 3861          | south_side   | 3861         |
+-----------------+---------------------+-------+----------+----------------+---------------+--------------+--------------+
```

Now let's create a predictor using the uploaded file. You can learn more about
the [`CREATE MODEL` command here](/sql/create/model).

```sql
CREATE MODEL mindsdb.home_rentals_model
FROM files
    (SELECT * from home_rentals)
PREDICT rental_price;
```

On execution, we get:

```sql
Query OK, 0 rows affected (x.xxx sec)
```

# Create a Project

## Description

MindsDB introduces projects that are a natural way to keep artifacts, such as models or views, separate according to what predictive task they solve. You can learn more about MindsDB projects [here](/sql/project).

## Syntax

Here is the syntax for creating a project:

```sql
CREATE PROJECT [IF NOT EXISTS] project_name;
```

# Remove a Project

## Description

The `DROP PROJECT` statement deletes the project.

## Syntax

Here is the syntax:

```sql
DROP PROJECT [IF EXISTS] project_name;
```

On execution, we get:

```sql
Query successfully completed
```

# List Projects

## Description

The `SHOW DATABASES` command lists all available data sources and projects. The `WHERE` clause filters all projects.

## Syntax

Here is the syntax:

```sql
SHOW DATABASES
WHERE type = 'project';
```

Alternatively, you can use the `FULL` keyword to get more information:

```sql
SHOW FULL DATABASES
WHERE type = 'project';
```

# Use a Project

## Description

The `USE` statement will change the context of MindsDB to the specified project. This allows you to run subsequent queries within the context of that project.

## Syntax

Here is the syntax:

```sql
USE project_name;
```

On execution, we get:

```sql
Query successfully completed
```

# JOBS

MindsDB enables you to automate any pipeline using JOBS, which grant you the power to schedule any query at any frequency. Additionally, it introduces the keyword <strong>[LAST](#last)</strong>, offering the capability for a JOB to act solely on new data, essentially treating any data source as a stream.

<p align="center">
  <img src="https://docs.google.com/drawings/d/e/2PACX-1vT_q7R0X4HHsSxHaMPJ2RgFtF-RP_sK6gjC9Kz4cG99AHi94yDh2dPttax7Za54IU5me4Zs4JwmW_of/pub?w=955&h=456" />
</p>

## Description

The `CREATE JOB` statement lets you schedule the execution of queries by providing relevant parameters, such as start date, end date, or repetition frequency.

## Syntax

### `CREATE JOB`

Here is the syntax:

```sql
CREATE JOB [IF NOT EXISTS] [project_name.]job_name [AS] (
   <statement_1>[; <statement_2>][; ...]
)
[START <date>]
[END <date>]
[EVERY [number] <period>]
[IF (<statement_1>[; <statement_2>][; ...])];
```

Where:

| Expression                                     | Description                                                                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[project_name.]job_name`                      | Name of the job preceded by an optional project name where the job is to be created. If you do not provide the `project_name` value, then the job is created in the default `mindsdb` project. |
| `<statement_1>[; <statement_2>][; ...]`        | One or more statements separated by `;` to be executed by the job.                                                                                                                             |
| `[START <date>]`                               | Optional. The date when the job starts its periodical or one-time execution. If not set, it is the current system date.                                                                        |
| `[END <date>]`                                 | Optional. The date when the job ends its periodical or one-time execution. If it is not set (and the repetition rules are set), then the job repeats forever.                                  |
| `[EVERY [number] <period>]`                    | Optional. The repetition rules for the job. If not set, the job runs once, not considering the end date value. If the `number` value is not set, it defaults to 1.                             |
| `[IF (<statement_1>[; <statement_2>][; ...])]` | Optional. If the last statement returns one or more rows, only then the job will execute.                                                                                                      |

<Info>
  **Available `<date>` formats**

  Here are the supported `<date>` formats:

  * `'%Y-%m-%d %H:%M:%S'`
  * `'%Y-%m-%d'`

  Please note that the default time zone is UTC.
</Info>

<Info>
  **Available `<period>` values**

  And the supported `<period>` values:

  * `minute` / `minutes` / `min`
  * `hour` / `hours`
  * `day` / `days`
  * `week` / `weeks`
  * `month` / `months`
</Info>

Further, you can query all jobs and their execution history like this:

```sql
SHOW JOBS;
SELECT * FROM [project_name.]jobs WHERE name = 'job_name';
SELECT * FROM log.jobs_history WHERE project = 'mindsdb' AND name = 'job_name';
```

### `LAST`

MindsDB provides a custom `LAST` keyword that enables you to fetch data inserted after the last time you queried for it. It is a convenient way to select only the newly added data rows when running a job.

Imagine you have the `fruit_data` table that contains the following:

```sql
+-------+-----------+
| id    | name      |
+-------+-----------+
| 1     | apple     |
| 2     | orange    |
+-------+-----------+
```

When you run the `SELECT` query with the `LAST` keyword for the first time, it'll give an empty output.

```sql
SELECT id, name
FROM fruit_data
WHERE id > LAST;
```

This query returns:

```sql
+-------+-----------+
| id    | name      |
+-------+-----------+
| null  | null      |
+-------+-----------+
```

<Tip>
  If you want to specify a concrete value for `LAST` in the first execution of such a query, use the `COALESCE(LAST, <value>)` function.

  ```sql
  SELECT id, name
  FROM fruit_data
  WHERE id > COALESCE(LAST, 1);
  ```

  It will result in executing the following query in the first run:

  ```sql
  SELECT id, name
  FROM fruit_data
  WHERE id > 1;
  ```

  And the below query at each subsequent run:

  ```sql
  SELECT id, name
  FROM fruit_data
  WHERE id > LAST;
  ```
</Tip>

Now imagine you inserted a new record into the `fruit_data` table:

```sql
+-------+-----------+
| id    | name      |
+-------+-----------+
| 1     | apple     |
| 2     | orange    |
| 3     | pear      |
+-------+-----------+
```

When you run the `SELECT` query with the `LAST` keyword again, you'll get only the newly added record as output.

```sql
SELECT id, name
FROM fruit_data
WHERE id > LAST;
```

This query returns:

```sql
+-------+-----------+
| id    | name      |
+-------+-----------+
| 3     | pear      |
+-------+-----------+
```

From this point on, whenever you add new records into the `fruit_data` table, it'll be returned by the next run of the `SELECT` query with the `LAST` keyword. And, if you do not add any new records between the query runs, then the output will be null.

If you want to clear context for the `LAST` keyword in the editor, then run `set context = 0` or `set context = null`.

### Conditional Jobs

Here is how you can create a conditional job that will execute periodically only if there is new data available:

```sql
CREATE JOB conditional_job (

    FINETUNE MODEL model_name
    FROM (     
        SELECT *
        FROM datasource.table_name
        WHERE incremental_column > LAST
    )
)
EVERY 1 min
IF (
    SELECT *
    FROM datasource.table_name
    WHERE incremental_column > LAST
);
```

The above job will be triggered every minute, but it will execute its task (i.e. finetuning the model) only if there is new data available.

## Examples

### Example 1: Retrain a Model

In this example, we create a job in the current project to retrain the `home_rentals_model` model and insert predictions into the `rentals` table.

```sql
CREATE JOB retrain_model_and_save_predictions (

   RETRAIN mindsdb.home_rentals_model
   USING
      join_learn_process = true;

   INSERT INTO my_integration.rentals (
      SELECT m.rental_price, m.rental_price_explain
      FROM mindsdb.home_rentals_model AS m
      JOIN example_db.demo_data.home_rentals AS d
   )
)
END '2023-04-01 00:00:00'
EVERY 2 days;
```

<Tip>
  Please note that the `join_learn_process` parameter in the `USING` clause of the [`RETRAIN`](/sql/api/retrain) statement ensures that the retraining process completes before inserting predictions into a table. In general, this parameter is used to prevent several retrain processes from running simultaneously.
</Tip>

The `retrain_model_and_save_predictions` job starts its execution on the current system date and ends on the 1st of April 2023. The job is executed every 2 days.

### Example 2: Save Predictions

In this example, the job creates a table named as `result_{{START_DATETIME}}` and inserts predictions into it.

```sql
CREATE JOB save_predictions (

   CREATE TABLE my_integration.`result_{{START_DATETIME}}` (
      SELECT m.rental_price, m.rental_price_explain
      FROM mindsdb.home_rentals_model AS m
      JOIN example_db.demo_data.home_rentals AS d
   )
)
EVERY hour;
```

<Tip>
  Please note that the uniqueness of the created table name is ensured here by using the `{{START_DATETIME}}` variable that is replaced at runtime by the date and time of the current run.

  You can use the following variables for this purpose:

  * `PREVIOUS_START_DATETIME` is replaced by date and time of the previous run of this job.
  * `START_DATETIME` is replaced by date and time of the current job run.
  * `START_DATE` is replaced by date of the current job run.
</Tip>

The `save_predictions` job starts its execution on the current system date and repeats every 2 hours until it is manually disabled.

### Example 3: Drop a Model

In this example, we create a job to drop the `home_rentals_model` model scheduled on the 1st of April 2023.

```sql
CREATE JOB drop_model (

   DROP MODEL mindsdb.home_rentals_model
) 
START '2023-04-01';
```

This job runs once on the 1st of April 2023.

### Example 4: Twitter Chatbot

You can easily create a chatbot to respond to tweets using jobs. But before you get to it, you should connect your Twitter account to MindsDB following the instructions [here](/integrations/app-integrations/twitter).

<Tip>
  Follow the [tutorial on how to create a Twitter chatbot](/sql/tutorials/twitter-chatbot) to learn the details.
</Tip>

Let's create a job that runs every hour, checks for new tweets, and responds using the OpenAI model.

```sql
CREATE JOB mindsdb.gpt4_twitter_job AS (

   -- insert into tweets the output of joining model and new tweets
   INSERT INTO my_twitter_v2.tweets (in_reply_to_tweet_id, text)
      SELECT
         t.id AS in_reply_to_tweet_id,
         r.response AS text
      FROM my_twitter.tweets t
      JOIN mindsdb.snoopstein_model r
         WHERE
            t.query = '(@snoopstein OR @snoop_stein OR #snoopstein OR #snoop_stein) -is:retweet -from:snoop_stein'
         AND t.created_at > LAST
      LIMIT 10
)
EVERY hour;
```

The [`SELECT`](/sql/api/select) statement joins the data table with the model table to get responses for newly posted tweets, thanks to the `LAST` keyword. Then, the [`INSERT INTO`](/sql/api/insert) statement writes these responses to the `tweets` table of the `my_twitter` integration.

<Tip>
  To learn more about OpenAI integration with MindsDB, visit our docs [here](/nlp/nlp-mindsdb-openai).
</Tip>

## Additional Configuration

Here is the template of the `config.json` file that you can pass as a parameter when starting your local MindsDB instance:

```bash
"jobs": {
        "disable": true,
        "check_interval": 30
      }
```

The `disable` parameter defines whether the scheduler is active (`true`) or not (`false`). By default, in the MindsDB Editor, the scheduler is active.

The `check_interval` parameter defines the interval in seconds between consecutive checks of the scheduler table. By default, in the MindsDB Editor, it is 30 seconds.

You can modify the default configuration in your local MindsDB installation by creating a `config.json` file and starting MindsDB with this file as a parameter. You can find detailed instructions [here](/setup/custom-config#starting-mindsdb-with-extended-configuration).

# Remove a Job

## Description

The `DROP JOB` statement deletes the job.

## Syntax

Here is the syntax for deleting a job:

```sql
DROP JOB [IF EXISTS] [project_name.]job_name;
```

The `project_name` value is optional. The `job_name` value indicates the job to be deleted.

Let's look at some examples:

```sql
DROP JOB my_project.retrain_and_save_job;
```

Here we drop the `retrain_and_save_job` that resides in the `my_project` project.

And another example:

```sql
DROP JOB create_table_job;
```

Here we drop the `create_table_job` job that resides in the current project.

To learn more about projects in MindsDB, visit our docs [here](/sql/project).

# Query Jobs

## Querying Jobs

Here is how we can view all jobs in a project:

```sql
SHOW JOBS WHERE project = 'project-name';

SELECT * FROM project-name.jobs;
```

On execution, we get:

```sql
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+---------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| NAME                               | PROJECT | RUN_START                  | RUN_END                    | NEXT_RUN_AT                | SCHEDULE_STR  | QUERY                                                                                                                                                                                                                                   |
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+---------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| drop_model                         | mindsdb | 2023-04-01 00:00:00.000000 | [NULL]                     | 2023-04-01 00:00:00.000000 | [NULL]        | DROP MODEL mindsdb.home_rentals_model                                                                                                                                                                                                   |
| retrain_model_and_save_predictions | mindsdb | 2023-02-15 19:19:43.210122 | 2023-04-01 00:00:00.000000 | 2023-02-15 19:19:43.210122 | every 2 days  | RETRAIN mindsdb.home_rentals_model USING join_learn_process = true; INSERT INTO my_integration.rentals (SELECT m.rental_price, m.rental_price_explain FROM mindsdb.home_rentals_model AS m JOIN example_db.demo_data.home_rentals AS d) |
| save_predictions                   | mindsdb | 2023-02-15 19:19:48.545580 | [NULL]                     | 2023-02-15 19:19:48.545580 | every hour    | CREATE TABLE my_integration.`result_{{START_DATETIME}}` (SELECT m.rental_price, m.rental_price_explain FROM mindsdb.home_rentals_model AS m JOIN example_db.demo_data.home_rentals AS d)                                                |
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+---------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

Or from all projects at once:

```sql
SHOW JOBS;

SELECT *
FROM information_schema.jobs;
```

## Querying Jobs History

You can query the history of jobs similar to querying for jobs. Here you can find information about an error if the job didn't execute successfully.

Here is how we can view all jobs history in the current project:

```sql
SELECT *
FROM log.jobs_history
WHERE project = 'mindsdb';
```

On execution, we get:

```sql
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+--------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| NAME                               | PROJECT | RUN_START                  | RUN_END                    | NEXT_RUN_AT                | ERROR  | QUERY                                                                                                                                                                                                                                   |
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+--------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| retrain_model_and_save_predictions | mindsdb | 2023-02-15 19:19:43.210122 | 2023-04-01 00:00:00.000000 | 2023-02-15 19:19:43.210122 | [NULL] | RETRAIN mindsdb.home_rentals_model USING join_learn_process = true; INSERT INTO my_integration.rentals (SELECT m.rental_price, m.rental_price_explain FROM mindsdb.home_rentals_model AS m JOIN example_db.demo_data.home_rentals AS d) |
| save_predictions                   | mindsdb | 2023-02-15 19:19:48.545580 | [NULL]                     | 2023-02-15 19:19:48.545580 | [NULL] | CREATE TABLE my_integration.`result_{{START_DATETIME}}` (SELECT m.rental_price, m.rental_price_explain FROM mindsdb.home_rentals_model AS m JOIN example_db.demo_data.home_rentals AS d)                                                |
+------------------------------------+---------+----------------------------+----------------------------+----------------------------+--------+-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

Please note that the `drop_model` job is not in the `jobs_history` table because it didn't start yet.
# Create a Trigger

## Description

Triggers enable users to define event-based actions. For example, if a table is updated, then run a query to update predictions.

<Info>
  Currently, you can create triggers on the following data sources:

  * [MongoDB](/integrations/data-integrations/mongodb) (available for MongoDB Atlas Database),
  * [Slack](/integrations/app-integrations/slack),
  * [Solace](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/solace_handler),
  * [PostgreSQL](/integrations/data-integrations/postgresql) (requires write access).
</Info>

## Syntax

Here is the syntax for creating a trigger:

```sql
CREATE TRIGGER trigger_name
ON integration_name.table_name
[COLUMNS column_name1, column_name2, ...]
(
    sql_code
) 
```

By creating a trigger on a data source, every time this data source is updated or new data is inserted, the `sql_code` provided in the statement will be executed.

You can create a trigger either on a table...

```sql
CREATE TRIGGER trigger_name
ON integration_name.table_name
(
    sql_code
) 
```

...or on one or more columns of a table.

```sql
CREATE TRIGGER trigger_name
ON integration_name.table_name
COLUMNS column_name1, column_name2
(
    sql_code
) 
```

Here is how to list all triggers:

```sql
SHOW TRIGGERS;
```

## Example

Firstly, connect Slack to MindsDB following [this instruction](/integrations/app-integrations/slack#set-up-a-slack-app-and-generate-tokens) and connect the Slack app to a channel.

```sql
CREATE DATABASE mindsdb_slack
WITH
  ENGINE = 'slack',
  PARAMETERS = {
      "token": "xoxb-...",
      "app_token": "xapp-..."
    };
```

Create a model that will be used to answer chat questions every time new messages arrive. Here we use the [OpenAI engine](/integrations/ai-engines/openai), but you can use any [other LLM](/integrations/ai-overview#large-language-models).

```sql
CREATE MODEL chatbot_model
PREDICT answer
USING
    engine = 'openai_engine',
    prompt_template = 'answer the question: {{text}}';
```

Here is how to generate answers to Slack messages using the model:

```sql
SELECT s.text AS question, m.answer
FROM chatbot_model m
JOIN mindsdb_slack.messages s
WHERE s.channel_id = 'slack-bot-channel-id' 
AND s.user != 'U07J30KPAUF'
AND s.created_at > LAST;
```

Let's analyze this query:

* We select the question from the Slack connection and the answer generated by the model.
* We join the model with the `messages` table.
* In the `WHERE` clause:
  * We provide the channel name where the app/bot is integrated.
  * We exclude the messages sent by the app/bot. You can find the user ID of the app/bot by querying the `mindsdb_slack.users` table.
  * We use the `LAST` keyword to ensure that the model generates answers only to the newly sent messages.

Finally, create a trigger that will insert an answer generated by the model every time when new messages are sent to the channel.

```sql
CREATE TRIGGER slack_trigger
ON mindsdb_slack.messages
(
    INSERT INTO mindsdb_slack.messages (channel_id, text)
        SELECT 'slack-bot-channel-id' AS channel_id, answer AS text
        FROM chatbot_model m
        JOIN TABLE_DELTA s
        WHERE s.user != 'slack-bot-id' # this is to prevent the bot from replying to its own messages
        AND s.channel_id = 'slack-bot-channel-id'
);
```

Let's analyze this statement:

* We create a trigger named `slack_trigger`.
* The trigger is created on the `mindsdb_slack.messages` table. Therefore, every time when data is added or updated, the trigger will execute its code.
* We provide the code to be executed by the trigger every time the triggering event takes place.
  * We insert an answer generated by the model into the `messages` table.
  * The `TABLE_DELTA` stands for the table on which the trigger has been created.
  * We exclude the messages sent by the app/bot. You can find the user ID of the app/bot by querying the `mindsdb_slack.users` table.

# Remove a Trigger

## Description

Triggers enable users to define event-based actions. For example, if a table is updated, then run a query to update predictions.

<Info>
  Currently, you can create triggers on the following data sources: [MongoDB](https://docs.mindsdb.com/integrations/data-integrations/mongodb), [Slack](https://docs.mindsdb.com/integrations/app-integrations/slack), [Solace](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/solace_handler).
</Info>

## Syntax

Here is the syntax for removing a trigger:

```sql
DROP TRIGGER trigger_name;
```

# Query Triggers

## Description

Triggers enable users to define event-based actions. For example, if a table is updated, then run a query to update predictions.

<Info>
  Currently, you can create triggers on the following data sources: [MongoDB](https://docs.mindsdb.com/integrations/data-integrations/mongodb), [Slack](https://docs.mindsdb.com/integrations/app-integrations/slack), [Solace](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/solace_handler).
</Info>

## Syntax

Here is the syntax for querying all triggers:

```sql
SHOW TRIGGERS;
```

# The LLM() Function

MindsDB provides the `LLM()` function that lets users incorporate the LLM-generated output directly into the data queries.

## Prerequisites

The `LLM()` function requires a large language model, which can be defined in the following ways:

* By setting the `default_llm` parameter in the [MindsDB configuration file](/setup/custom-config#default-llm).
* By saving the default model in the MindsDB Editor under Settings.
* By defining the environment variables as below, choosing one of the available model providers.

  <AccordionGroup>
    <Accordion title="OpenAI">
      Here are the environment variables for the OpenAI provider:

      ```
      LLM_FUNCTION_MODEL_NAME
      LLM_FUNCTION_TEMPERATURE
      LLM_FUNCTION_MAX_RETRIES
      LLM_FUNCTION_MAX_TOKENS
      LLM_FUNCTION_BASE_URL
      OPENAI_API_KEY
      LLM_FUNCTION_API_ORGANIZATION
      LLM_FUNCTION_REQUEST_TIMEOUT
      ```

      Note that the values stored in the environment variables are specific for each provider.
    </Accordion>

    <Accordion title="Anthropic">
      Here are the environment variables for the Anthropic provider:

      ```
      LLM_FUNCTION_MODEL_NAME
      LLM_FUNCTION_TEMPERATURE
      LLM_FUNCTION_MAX_TOKENS
      LLM_FUNCTION_TOP_P
      LLM_FUNCTION_TOP_K
      LLM_FUNCTION_DEFAULT_REQUEST_TIMEOUT
      LLM_FUNCTION_API_KEY
      LLM_FUNCTION_BASE_URL
      ```

      Note that the values stored in the environment variables are specific for each provider.
    </Accordion>

    <Accordion title="LiteLLM">
      Here are the environment variables for the LiteLLM provider:

      ```
      LLM_FUNCTION_MODEL_NAME
      LLM_FUNCTION_TEMPERATURE
      LLM_FUNCTION_API_BASE
      LLM_FUNCTION_MAX_RETRIES
      LLM_FUNCTION_MAX_TOKENS
      LLM_FUNCTION_TOP_P
      LLM_FUNCTION_TOP_K
      ```

      Note that the values stored in the environment variables are specific for each provider.
    </Accordion>

    <Accordion title="Ollama">
      Here are the environment variables for the Ollama provider:

      ```
      LLM_FUNCTION_BASE_URL
      LLM_FUNCTION_MODEL_NAME
      LLM_FUNCTION_TEMPERATURE
      LLM_FUNCTION_TOP_P
      LLM_FUNCTION_TOP_K
      LLM_FUNCTION_REQUEST_TIMEOUT
      LLM_FUNCTION_FORMAT
      LLM_FUNCTION_HEADERS
      LLM_FUNCTION_NUM_PREDICT
      LLM_FUNCTION_NUM_CTX
      LLM_FUNCTION_NUM_GPU
      LLM_FUNCTION_REPEAT_PENALTY
      LLM_FUNCTION_STOP
      LLM_FUNCTION_TEMPLATE
      ```

      Note that the values stored in the environment variables are specific for each provider.
    </Accordion>

    <Accordion title="Nvidia NIMs">
      Here are the environment variables for the Nvidia NIMs provider:

      ```
      LLM_FUNCTION_BASE_URL
      LLM_FUNCTION_MODEL_NAME
      LLM_FUNCTION_TEMPERATURE
      LLM_FUNCTION_TOP_P
      LLM_FUNCTION_REQUEST_TIMEOUT
      LLM_FUNCTION_FORMAT
      LLM_FUNCTION_HEADERS
      LLM_FUNCTION_NUM_PREDICT
      LLM_FUNCTION_NUM_CTX
      LLM_FUNCTION_NUM_GPU
      LLM_FUNCTION_REPEAT_PENALTY
      LLM_FUNCTION_STOP
      LLM_FUNCTION_TEMPLATE
      LLM_FUNCTION_NVIDIA_API_KEY
      ```

      Note that the values stored in the environment variables are specific for each provider.
    </Accordion>
  </AccordionGroup>

<Note>
  **OpenAI-compatible model providers** can be used like OpenAI models.

  There is a number of OpenAI-compatible model providers including OpenRouter or vLLM. To use models via these providers, users need to define the base URL and the API key of the provider.

  Here is an example of using OpenRouter.

  ```
  LLM_FUNCTION_MODEL_NAME = "mistralai/devstral-small-2505"
  LLM_FUNCTION_BASE_URL = "https://openrouter.ai/api/v1"
  OPENAI_API_KEY = "openrouter-api-key"
  ```
</Note>

## Usage

You can use the `LLM()` function to simply ask a question and get an answer.

```sql
SELECT LLM('How many planets are there in the solar system?');
```

Here is the output:

```sql
+------------------------------------------+
| llm                                      |
+------------------------------------------+
| There are 8 planets in the solar system. |
+------------------------------------------+
```

Moreover, you can use the `LLM()` function with your data to swiftly complete tasks such as text generation or summarization.

```sql
SELECT
    comment,
    LLM('Describe the comment''s category in one word: ' || comment) AS category
FROM example_db.user_comments;
```

Here is the output:

```sql
+--------------------------+----------+
| comment                  | category |
+--------------------------+----------+
| I hate tacos             | Dislike  |
| I want to dance          | Desire   |
| Baking is not a big deal | Opinion  |
+--------------------------+----------+
```

# The TO_MARKDOWN() Function

MindsDB provides the `TO_MARKDOWN()` function that lets users extract the content of their documents in markdown by simply specifying the document path or URL. This function is especially useful for passing the extracted content of documents through LLMs or for storing them in a [Knowledge Base](/mindsdb_sql/agents/knowledge-bases).

## Configuration

The `TO_MARKDOWN()` function supports different file formats and methods of passing documents into it, as well as an LLM required for processing documents.

### Supported File Formats

The `TO_MARKDOWN()` function supports PDF, XML, and Nessus file formats. The documents can be provided from URLs, file storage, or Amazon S3 storage.

### Supported LLMs

The `TO_MARKDOWN()` function requires an LLM to process the document content into the Markdown format.

The supported LLM providers include:

* OpenAI
* Azure OpenAI
* Google

<Info>
  The model you select must support multi-modal inputs, that is, both images and text. For example, OpenAI’s gpt-4o is a supported multi-modal model.
</Info>

User can provide an LLM using one of the below methods:

1. Set the default model in the Settings of MindsDB Editor.
2. Set the default model in the [MindsDB configuration file](/setup/custom-config#default-llm).
3. Use environment variables defined below to set an LLM specifically for the `TO_MARKDOWN()` function.

   The `TO_MARKDOWN_FUNCTION_PROVIDER` environment variable defines the selected provider, which is one of `openai`, `azure_openai`, or `google`.

   <AccordionGroup>
     <Accordion title="OpenAI">
       Here are the environment variables for the OpenAI provider:

       ```
       TO_MARKDOWN_FUNCTION_API_KEY (required)
       TO_MARKDOWN_FUNCTION_MODEL_NAME
       TO_MARKDOWN_FUNCTION_TEMPERATURE
       TO_MARKDOWN_FUNCTION_MAX_RETRIES
       TO_MARKDOWN_FUNCTION_MAX_TOKENS
       TO_MARKDOWN_FUNCTION_BASE_URL
       TO_MARKDOWN_FUNCTION_API_ORGANIZATION
       TO_MARKDOWN_FUNCTION_REQUEST_TIMEOUT
       ```
     </Accordion>

     <Accordion title="Azure OpenAI">
       Here are the environment variables for the Azure OpenAI provider:

       ```
       TO_MARKDOWN_FUNCTION_API_KEY (required)
       TO_MARKDOWN_FUNCTION_BASE_URL (required)
       TO_MARKDOWN_FUNCTION_API_VERSION (required)
       TO_MARKDOWN_FUNCTION_MODEL_NAME
       TO_MARKDOWN_FUNCTION_TEMPERATURE
       TO_MARKDOWN_FUNCTION_MAX_RETRIES
       TO_MARKDOWN_FUNCTION_MAX_TOKENS
       TO_MARKDOWN_FUNCTION_API_ORGANIZATION
       TO_MARKDOWN_FUNCTION_REQUEST_TIMEOUT
       ```
     </Accordion>

     <Accordion title="Google">
       Here are the environment variables for the Google provider:

       ```
       TO_MARKDOWN_FUNCTION_API_KEY
       TO_MARKDOWN_FUNCTION_MODEL_NAME
       TO_MARKDOWN_FUNCTION_TEMPERATURE
       TO_MARKDOWN_FUNCTION_MAX_TOKENS
       TO_MARKDOWN_FUNCTION_REQUEST_TIMEOUT
       ```
     </Accordion>
   </AccordionGroup>

## Usage

You can use the `TO_MARKDOWN()` function to extract the content of your documents in markdown format. The arguments for this function are:

* `file_path_or_url`: The path or URL of the document you want to extract content from.

<AccordionGroup>
  <Accordion title="From Amazon S3">
    The following example shows how to use the `TO_MARKDOWN()` function with a PDF document from [Amazon S3 storage connected to MindsDB](/integrations/data-integrations/amazon-s3).

    ```sql
    SELECT TO_MARKDOWN(public_url) FROM s3_datasource.files;
    ```

    Here are the steps for passing files from Amazon S3 into TO\_MARKDOWN().

    1. Connect Amazon S3 to MindsDB following [this instruction](/integrations/data-integrations/amazon-s3).
    2. The `public_url` of the file is generated in the `s3_datasource.files` table upon connecting the Amazon S3 data source to MindsDB.
    3. Upon running the above query, the `public_url` of the file is selected from the `s3_datasource.files` table.
  </Accordion>

  <Accordion title="From URL">
    The following example shows how to use the `TO_MARKDOWN()` function with a PDF document from URL.

    ```sql
    SELECT TO_MARKDOWN('https://www.princexml.com/howcome/2016/samples/invoice/index.pdf');
    ```

    Here is the output:

    ````sql
    +----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
    | to_markdown                                                                                                                                                                                                                                  |
    +----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
    | ```markdown                                                                                                                                                                                                                                  |
    | # Invoice                                                                                                                                                                                                                                    |
    |                                                                                                                                                                                                                                              |
    | YesLogic Pty. Ltd.                                                                                                                                                                                                                           |
    | 7 / 39 Bouverie St                                                                                                                                                                                                                           |
    | Carlton VIC 3053                                                                                                                                                                                                                             |
    | Australia                                                                                                                                                                                                                                    |
    |                                                                                                                                                                                                                                              |
    | www.yeslogic.com                                                                                                                                                                                                                             |
    | ABN 32 101 193 560                                                                                                                                                                                                                           |
    |                                                                                                                                                                                                                                              |
    | Customer Name                                                                                                                                                                                                                                |
    | Street                                                                                                                                                                                                                                       |
    | Postcode City                                                                                                                                                                                                                                |
    | Country                                                                                                                                                                                                                                      |
    |                                                                                                                                                                                                                                              |
    | Invoice date: | Nov 26, 2016                                                                                                                                                                                                                 |
    | --- | ---                                                                                                                                                                                                                                    |
    | Invoice number: | 161126                                                                                                                                                                                                                     |
    | Payment due: | 30 days after invoice date                                                                                                                                                                                                    |
    |                                                                                                                                                                                                                                              |
    | | Description               | From        | Until       | Amount     |                                                                                                                                                                       |
    | |---------------------------|-------------|-------------|------------|                                                                                                                                                                       |
    | | Prince Upgrades & Support | Nov 26, 2016 | Nov 26, 2017 | USD $950.00 |                                                                                                                                                                    |
    | | Total                     |             |             | USD $950.00 |                                                                                                                                                                      |
    |                                                                                                                                                                                                                                              |
    | Please transfer amount to:                                                                                                                                                                                                                   |
    |                                                                                                                                                                                                                                              |
    | Bank account name: | Yes Logic Pty Ltd                                                                                                                                                                                                       |
    | --- | ---                                                                                                                                                                                                                                    |
    | Name of Bank: | Commonwealth Bank of Australia (CBA)                                                                                                                                                                                         |
    | Bank State Branch (BSB): | 063010                                                                                                                                                                                                            |
    | Bank State Branch (BSB): | 063010                                                                                                                                                                                                            |
    | Bank State Branch (BSB): | 063019                                                                                                                                                                                                            |
    | Bank account number: | 13201652                                                                                                                                                                                                              |
    | Bank SWIFT code: | CTBAAU2S                                                                                                                                                                                                                  |
    | Bank address: | 231 Swanston St, Melbourne, VIC 3000, Australia                                                                                                                                                                              |
    |                                                                                                                                                                                                                                              |
    | The BSB number identifies a branch of a financial institution in Australia. When transferring money to Australia, the BSB number is used together with the bank account number and the SWIFT code. Australian banks do not use IBAN numbers. |
    |                                                                                                                                                                                                                                              |
    | www.yeslogic.com                                                                                                                                                                                                                             |
    | ```                                                                                                                                                                                                                                          |
    +----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
    ````
  </Accordion>
</AccordionGroup>

The content of each PDF page is intelligently extracted by first assessing how visually complex the page is. Based on this assessment, the system decides whether traditional text parsing is sufficient or if the page should be processed using an LLM.

### Usage with Knowledge Bases

You can also use the `TO_MARKDOWN()` function to extract content from documents and store it in a [Knowledge Base](/mindsdb_sql/agents/knowledge-bases). This is particularly useful for creating a Knowledge Base from a collection of documents.

```sql
INSERT INTO my_kb (
  SELECT
    HASH('https://www.princexml.com/howcome/2016/samples/invoice/index.pdf') as id,
    TO_MARKDOWN('https://www.princexml.com/howcome/2016/samples/invoice/index.pdf') as content
)
```

# The FROM_ENV() Function

MindsDB provides the `FROM_ENV()` function that lets users pull values from the environment variables into MindsDB.

## Usage

Here is how to use the `FROM_ENV()` function.

```sql
FROM_ENV("MDB_MY_ENV_VAR")
```

Note that due to security concerns, **only the environment variables with name starting with `MDB_` can be extracted with the `from_env()` function**.

Learn more about [MindsDB variables here](/mindsdb_sql/functions/variables).

# Bring Your Own Function

Custom functions provide advanced means of manipulating data. Users can upload custom functions written in Python to MindsDB and apply them to data.

## How It Works

You can upload your custom functions via the MindsDB editor by clicking `Add` and `Upload custom functions`, like this:

<p align="center">
  <img src="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=2ccf18d04467026fca12c941e9e999e4" data-og-width="217" width="217" data-og-height="278" height="278" data-path="assets/upload_custom_function.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=280&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=558817a89e72f37d6ff576ff92cbb5dd 280w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=560&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=82fe63272842d79f3aac5598a9d0811c 560w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=840&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=01c748eaba77bda0c42f336b3982f41d 840w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=1100&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=00f2becc5cb8a02fc7344025f1836e6e 1100w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=1650&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=115cbb2574243dc69136efc1524ad326 1650w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function.png?w=2500&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=f95e5a582f3e30a740e5eec8b951b88c 2500w" />
</p>

Here is the form that needs to be filled out in order to bring your custom functions to MindsDB:

<p align="center">
  <img src="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=6f519ffac0a3537f25823ab1250ae556" data-og-width="380" width="380" data-og-height="592" height="592" data-path="assets/upload_custom_function_empty_form.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=280&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=37b79bbdc35fad2707a49293a03c77ac 280w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=560&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=3ed6a81e41d3dc8447b966693a061126 560w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=840&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=6908df71aeeb82e5de791802b66e376a 840w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=1100&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=6b5e52bb4443c951983dad03090dc127 1100w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=1650&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=9dd6651472bbd82101df047f48380fa0 1650w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function_empty_form.png?w=2500&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=58c39367dd32b3f2437747299ccc1350 2500w" />
</p>

Let's briefly go over the files that need to be uploaded:

* The Python file stores an implementation of your custom functions. Here is the sample format:

  ```py
  def function_name_1(a:type, b:type) -> type:
      <implementation goes here>
      return x

  def function_name_2(a:type, b:type, c:type) -> type:
      <implementation goes here>
      return x
  ```

  <Note>
    Note that if the input and output types are not set, then `str` is used by default.
  </Note>

<Accordion title="Example">
  ```py
  def add_integers(a:int, b:int) -> int:
      return a+b
  ```
</Accordion>

* The optional requirements file, or `requirements.txt`, stores all dependencies along with their versions. Here is the sample format:

  ```sql
  dependency_package_1 == version
  dependency_package_2 >= version
  dependency_package_3 >= verion, < version
  ...
  ```

<Accordion title="Example">
  ```sql
  pandas
  scikit-learn
  ```
</Accordion>

Once you upload the above files, please provide the name for a storage collection.

Let's look at an example.

## Example

We upload the custom functions, as below:

<p align="center">
  <img src="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=fe7a7d53017ee716612d4139893c37cd" data-og-width="374" width="374" data-og-height="586" height="586" data-path="assets/upload_custom_function2.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=280&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=fbdb4fe83a9eabc84f803248c4a00ea9 280w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=560&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=4833ee78a1aa602b61936d7c40268230 560w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=840&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=48d420f5d9caacbb3089d862221c696f 840w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=1100&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=5848f2c4e9bef87dfa00316c6e986e7f 1100w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=1650&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=0868aa6a795ca54540108ebb3e9c9262 1650w, https://mintcdn.com/mindsdb/QF5BKvjknzzY0II3/assets/upload_custom_function2.png?w=2500&fit=max&auto=format&n=QF5BKvjknzzY0II3&q=85&s=7c6ee6a3946027a95fc231a73d5fb9db 2500w" />
</p>

Here we upload the `functions.py` file that stores an implementation of the functions and the `requirements.txt` file that stores all the dependencies. We named the storage collection as `custom_functions`.

Now we can use the functions as below:

```sql
SELECT functions.add_integers(sqft, 1) AS added_one, sqft
FROM example_db.home_rentals
LIMIT 1;
```

Here is the output:

```sql
+-----------+------+
| added_one | sqft |
+-----------+------+
| 918       | 917  |
+-----------+------+
```

# Variables

MindsDB supports the usage of variables. Users can save values of API keys or other frequently used values and pass them as variables when creating knowledge bases, agents, or other MindsDB object.

## Usage

Here is how to create variables in MindsDB.

* Create variables using `SET` and save values either using the [`from_env()` function](/mindsdb_sql/functions/from_env) or directly.

```sql
SET @my_env_var  = from_env("MDB_MY_ENV_VAR")

SET @my_value  = "123456"
```

* Use variables to pass parameters when creating objects in MindsDB.

Here is an example for [knowledge bases](/mindsdb_sql/knowledge_bases/overview).

```sql
CREATE KNOWLEDGE_BASE my_kb
USING
    embedding_model = {
       "provider": "openai",
       "model_name" : "text-embedding-3-large",
       "api_key": @my_env_var
    },
    ...;
```

# Configure an ML Engine

MindsDB integrates with numerous AI and ML frameworks that are made available via the AI/ML engines. The AI/ML engines are used to create models based on the particular AI/ML framework.

## Description

The `CREATE ML_ENGINE` command creates an ML engine that uses one of the available AI/ML handlers.

## Syntax

Before creating an AI/ML engine, make sure that the AI/ML handler of your interest is available by querying for the ML handlers.

```sql
SELECT *
FROM information_schema.handlers;
-- or 
SHOW HANDLERS;
```

<Info>
  If you can’t find the AI/ML handler of your interest, you can contribute by [building a new AI/ML handler](/contribute/ml-handlers).

  Please note that in the process of contributing new AI.ML engines, ML engines and/or their tests will only run correctly if all dependencies listed in the `requirements.txt` file are installed beforehand.
</Info>

If you find the AI/ML handler of your interest, then you can create an AI/ML engine using this command:

```sql
CREATE ML_ENGINE [IF NOT EXISTS] ml_engine_name
FROM handler_name
[USING argument_key = argument_value];
```

Please replace `ml_engine_name`, `handler_name`, and optionally, `argument_key` and `argument_value` with the real values.

<Note>
  Please do not use the same `ml_engine_name` as the `handler_name` to avoid issue while dropping the ML engine.
</Note>

To verify that your AI/ML engine was successfully created, run the command below:

```sql
SELECT *
FROM information_schema.ml_engines;
-- or 
SHOW ML_ENGINES;
```

If you want to drop an ML engine, run the command below:

```sql
DROP ML_ENGINE ml_engine_name;
```

## Example

Let's check what AI/ML handlers are currently available:

```sql
SHOW HANDLERS;
```

On execution, we get:

```sql
+-------------------+--------------------+-------------------------------------------------------+---------+-----------------------------------------------------------------------------------------------------------------------------------------------------+----------------+-----------------------------------------------------------------------------+
| NAME              | TITLE              | DESCRIPTION                                           | VERSION | CONNECTION_ARGS                                                                                                                                     | IMPORT_SUCCESS | IMPORT_ERROR                                                                |
+-------------------+--------------------+-------------------------------------------------------+---------+-----------------------------------------------------------------------------------------------------------------------------------------------------+----------------+-----------------------------------------------------------------------------+
| "ray_serve"       | "RayServe"         | "MindsDB handler for Ray Serve"                       | "0.0.1" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "neuralforecast"  | "NeuralForecast"   | "MindsDB handler for Nixtla's NeuralForecast package" | "0.0.1" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "autosklearn"     | "Auto-Sklearn"     | "MindsDB handler for Auto-Sklearn"                    | "0.0.2" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'autosklearn'"                                             |
| "mlflow"          | "MLFlow"           | "MindsDB handler for MLflow"                          | "0.0.2" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'mlflow'"                                                  |
| "openai"          | "OpenAI"           | "MindsDB handler for OpenAI"                          | "0.0.1" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "merlion"         | "Merlion"          | "MindsDB handler for Merlion"                         | "0.0.1" | "[NULL]"                                                                                                                                            | "false"        | "object.__init__() takes exactly one argument (the instance to initialize)" |
| "byom"            | "BYOM"             | "MindsDB handler for BYOM"                            | "0.0.1" | "{'code': {'type': 'path', 'description': 'The path to model code'}, 'modules': {'type': 'path', 'description': 'The path to model requirements'}}" | "true"         | "[NULL]"                                                                    |
| "ludwig"          | "Ludwig"           | "MindsDB handler for Ludwig AutoML"                   | "0.0.2" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'dask'"                                                    |
| "lightwood"       | "Lightwood"        | "[NULL]"                                              | "1.0.0" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "huggingface_api" | "Hugging Face API" | "MindsDB handler for Auto-Sklearn"                    | "0.0.2" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'hugging_py_face'"                                         |
| "statsforecast"   | "StatsForecast"    | "MindsDB handler for Nixtla's StatsForecast package"  | "0.0.0" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "huggingface"     | "Hugging Face"     | "MindsDB handler for Higging Face"                    | "0.0.1" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "TPOT"            | "Tpot"             | "MindsDB handler for TPOT "                           | "0.0.2" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'tpot'"                                                    |
| "langchain"       | "LangChain"        | "MindsDB handler for LangChain"                       | "0.0.1" | "[NULL]"                                                                                                                                            | "true"         | "[NULL]"                                                                    |
| "autokeras"       | "Autokeras"        | "MindsDB handler for Autokeras AutoML"                | "0.0.1" | "[NULL]"                                                                                                                                            | "false"        | "No module named 'autokeras'"                                               |
+-------------------+--------------------+-------------------------------------------------------+---------+-----------------------------------------------------------------------------------------------------------------------------------------------------+----------------+-----------------------------------------------------------------------------+
```

Here we create an AI/ML engine using the OpenAI handler and providing an OpenAI API key in the `USING` clause.

```sql
CREATE ML_ENGINE my_openai_engine
FROM openai
USING
    openai_api_key = '<your opanai api key>';
```

On execution, we get:

```sql
Query successfully completed
```

Now let's verify that our ML engine exists.

```sql
SHOW ML_ENGINES;
```

On execution, we get:

```sql
+-------------------+------------+------------------------------------------------------+
|NAME               |HANDLER     |CONNECTION_DATA                                       |
+-------------------+------------+------------------------------------------------------+
|lightwood          |lightwood   |{"key":["password"],"value":[""]}                     |
|huggingface        |huggingface |{"key":["password"],"value":[""]}                     |
|openai             |openai      |{"key":["password"],"value":[""]}                     |
|my_openai_engine   |openai      |{"key":["openai_api_key","password"],"value":["",""]} |
+-------------------+------------+------------------------------------------------------+
```

Please note that the `USING` clause is optional, as it depends on the AI/ML handler whether it requires some arguments or not. Here, we created an OpenAI engine and provided our own API key.

After creating your ML engine, you can create a model like this:

```sql
CREATE MODEL my_model
PREDICT answer
USING 
    engine = 'my_openai_engine',
    prompt_template = 'ask a question to a model'
```

The `USING` clause specifies the ML engine to be used for creating a new model.




