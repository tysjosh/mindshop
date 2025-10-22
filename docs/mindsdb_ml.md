# SQL API

MindsDB enhances standard SQL by providing AI building blocks.

This section introduces custom SQL syntax provided by MindsDB to bring data and AI together.

Follow these steps to get started:

<Steps>
  <Step title="Connect a data source">
    Use [CREATE DATABASE](/mindsdb_sql/sql/create/database) to connect your data source to MindsDB.<br />
    Explore all available [data sources here](/integrations/data-overview).
  </Step>

  <Step title="Configure an AI engine">
    Use [CREATE ML\_ENGINE](/mindsdb_sql/sql/create/ml-engine) to configure an engine of your choice.<br />
    Explore all available [AI engines here](/integrations/ai-overview).
  </Step>

  <Step title="Create and deploy an AI/ML model">
    Use [CREATE MODEL](/mindsdb_sql/sql/create/model) to create, train, and deploy AI/ML models within MindsDB.
  </Step>

  <Step title="Query for predictions">
    Query for a [single prediction](/mindsdb_sql/sql/get-single-prediction) or [batch predictions](/mindsdb_sql/sql/get-batch-predictions) by joining data with models.
  </Step>

  <Step title="Automate customized workflows">
    Use [JOB](/mindsdb_sql/sql/create/jobs), [TRIGGER](/mindsdb_sql/sql/create/trigger), or [AGENT](/mindsdb_sql/agents/agent) to automate workflows.
  </Step>
</Steps>




# Build an AI/ML Handler

In this section, you'll find how to create new machine learning (ML) handlers within MindsDB.

<Note>
  **Prerequisite**

  You should have the latest version of the MindsDB repository installed locally. Follow [this guide](/contribute/install/) to learn how to install MindsDB for development.
</Note>

## What are Machine Learning Handlers?

ML handlers act as a bridge to any ML framework. You use ML handlers to create ML engines using [the CREATE ML\_ENGINE command](/sql/create/ml-engine/). So you can expose ML models from any supported ML engine as an AI table.

<Note>
  **Database Handlers**

  To learn more about handlers and how to implement a database handler, visit our [doc page here](/contribute/data-handlers/).
</Note>

## Creating a Machine Learning Handler

You can create your own ML handler within MindsDB by inheriting from the [BaseMLEngine](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L123) class.

By providing the implementation for some or all of the methods contained in the `BaseMLEngine` class, you can connect with the machine learning library or framework of your choice.

### Core Methods

Apart from the `__init__()` method, there are five methods, of which two must be implemented. We recommend checking actual examples in the codebase to get an idea of what goes into each of these methods, as they can change a bit depending on the nature of the system being integrated.

Let's review the purpose of each method.

| Method            | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `create()`        | It creates a model inside the engine registry.                                   |
| `predict()`       | It calls a model and returns prediction data.                                    |
| `update()`        | Optional. It updates an existing model without resetting its internal structure. |
| `describe()`      | Optional. It provides global model insights.                                     |
| `create_engine()` | Optional. It connects with external sources, such as REST API.                   |

Authors can opt for adding private methods, new files and folders, or any combination of these to structure all the necessary work that will enable the core methods to work as intended.

<Tip>
  **Other Common Methods**

  Under the `mindsdb.integrations.libs.utils` library, contributors can find various methods that may be useful while implementing new handlers.

  Also, there is a wrapper class for the `BaseMLEngine` instances called [BaseMLEngineExec](https://github.com/mindsdb/mindsdb/blob/main/mindsdb/integrations/libs/ml_exec_base.py#L157). It is automatically deployed to take care of modifying the data responses into something that can be used alongside data handlers.
</Tip>

### Implementation

Here are the methods that must be implemented while inheriting from the [BaseMLEngine](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L123) class:

* [The create() method](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L151) saves a model inside the engine registry for later usage.

```py
def create(self, target: str, df: Optional[pd.DataFrame] = None, args: Optional[Dict] = None) -> None:
        """
        Saves a model inside the engine registry for later usage.
        Normally, an input dataframe is required to train the model.
        However, some integrations may merely require registering the model instead of training, in which case `df` can be omitted.
        Any other arguments required to register the model can be passed in an `args` dictionary.
        """
```

* [The predict() method](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L162) calls a model with an input dataframe and optionally, arguments to modify model's behaviour. This method returns a dataframe with the predicted values.

```py
def predict(self, df: pd.DataFrame, args: Optional[Dict] = None) -> pd.DataFrame:
        """
        Calls a model with some input dataframe `df`, and optionally some arguments `args` that may modify the model behavior.
        The expected output is a dataframe with the predicted values in the target-named column.
        Additional columns can be present, and will be considered row-wise explanations if their names finish with `_explain`.
        """
```

And here are the optional methods that you can implement alongside the mandatory ones if your ML framework allows it:

* [The update() method](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L171) is used to update, fine-tune, or adjust an existing model without resetting its internal state.

```py
def finetune(self, df: Optional[pd.DataFrame] = None, args: Optional[Dict] = None) -> None:
        """
        Optional.
        Used to update/fine-tune/adjust a pre-existing model without resetting its internal state (e.g. weights).
        Availability will depend on underlying integration support, as not all ML models can be partially updated.
        """
```

* [The describe() method](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L181) provides global model insights, such as framework-level parameters used in training.

```py
def describe(self, key: Optional[str] = None) -> pd.DataFrame:
        """
        Optional.
        When called, this method provides global model insights, e.g. framework-level parameters used in training.
        """
```

* [The create\_engine() method](https://github.com/mindsdb/mindsdb/blob/3d9090acb0b8b3b0e2a96e2c93dad436f5ebef90/mindsdb/integrations/libs/base.py#L189) is used to connect with the external sources, such as REST API.

```py
def create_engine(self, connection_args: dict):
        """
        Optional.
        Used to connect with external sources (e.g. a REST API) that the engine will require to use any other methods.
        """
```

## MindsDB ML Ecosystem

MindsDB has recently decoupled some modules out of its AutoML package in order to leverage them in integrations with other ML engines. The three modules are as follows:

1. The [type\_infer](https://github.com/mindsdb/type_infer) module that implements automated type inference for any dataset.<br />
   Below is the description of the input and output of this module.<br />
   **Input:** tabular dataset.<br />
   **Output:** best guesses of what type of data each column contains.

2. The [dataprep\_ml](https://github.com/mindsdb/dataprep_ml) module that provides data preparation utilities, such as data cleaning, analysis, and splitting. Data cleaning procedures include column-wise cleaners, column-wise missing value imputers, and data splitters (train-val-test split, either simple or stratified).<br />
   Below is the description of the input and output of this module.<br />
   **Input:** tabular dataset.<br />
   **Output:** cleaned dataset, plus insights useful for data analysis and model building.

3. The [mindsdb\_evaluator](https://github.com/mindsdb/mindsdb_evaluator) module that provides utilities for evaluating the accuracy and calibration of ML models.<br />
   Below is the description of the input and output of this module.<br />
   **Input:** model predictions and the input data used to generate these predictions, including corresponding ground truth values of the column to predict.<br />
   **Output:** accuracy metrics that evaluate prediction accuracy and calibration metrics that check whether model-emitted probabilities are calibrated.

We recommend that new contributors use [type\_infer](https://github.com/mindsdb/type_infer) and [dataprep\_ml](https://github.com/mindsdb/dataprep_ml) modules when writing ML handlers to avoid reimplementing thin AutoML layers over and over again; it is advised to focus on mapping input data and user parameters to the underlying framework’s API.

For now, using the [mindsdb\_evaluator](https://github.com/mindsdb/mindsdb_evaluator) module is not required, but will be in the short to medium term, so it’s important to be aware of it while writing a new integration.

<Tip>
  **Example**

  Let’s say you want to write an integration for `TPOT`. Its high-level API exposes classes that are either for classification or regression. But as a handler designer, you need to ensure that arbitrary ML tasks are dispatched properly to each class (i.e., not using a regressor for a classification problem and vice versa). First, `type_infer` can help you by estimating the data type of the target variable (so you immediately know what class to use). Additionally, to quickly get a stratified train-test split, you can leverage `dataprep_ml` splitters and continue to focus on the actual usage of TPOT for the training and inference logic.
</Tip>

<Note>
  We would appreciate your feedback regarding usage & feature roadmap for the above modules, as they are quite new.
</Note>

## Step-by-Step Instructions

<AccordionGroup>
  <Accordion title="Step 1: Set up and run MindsDB locally">
    1. Set up MindsDB using the [self-hosted pip](/setup/self-hosted/pip/source) installation method.
    2. Make sure you can run the [quickstart example](/quickstart) locally. If you run into errors, check your bash terminal output.
    3. Create a new git branch to store your changes.
  </Accordion>

  <Accordion title="Step 2: Write a (failing) test for your new handler">
    1. Check that you can run the existing handler tests with `python -m pytest tests/unit/ml_handlers/`. If you get the `ModuleNotFoundError` error, try adding the `__init__.py` file to any subdirectory that doesn't have it.

    2. Copy the simple tests from a relevant handler. For regular data, use the [Ludwig](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/ludwig_handler) handler. And for time series data, use the [StatsForecast](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/statsforecast_handler) handler.

    3. Change the SQL query to reference your handler. Specifically, set `USING engine={HandlerName}`.

    4. Run your new test. Please note that it should fail as you haven’t yet added your handler. The exception should be `Can't find integration_record for handler ...`.
  </Accordion>

  <Accordion title="Step 3: Add your handler to the source code">
    1. Create a new directory in `mindsdb/integrations/handlers/`. You must name the new directory `{HandlerName}_handler/`.

    2. Copy the `.py` files from the [OpenAI handler folder](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/openai_handler), including: `__about__.py`, `__init__.py`, `openai_handler.py`, `creation_args.py`, and `model_using_args.py`.

    <Note>
      Note that the arguments used at model creation time (stored in `creation_args.py`) and the arguments used at prediction time (stored in `model_using_args.py`) should be stored in separate files in order to be able to hide sensitive information such as API keys.

      By default, when querying for `connection_data` from the `information_schema.ml_engines` table or `training_options` from the `information_schema.models` table, all sensitive information is hidden. To unhide it, use this command:

      ```sql
      set show_secrets=true;
      ```
    </Note>

    3. Change the contents of `.py` files to match your new handler. Also, change the name of the `statsforecast_handler.py` file to match your handler.

    4. Modify the `requirements.txt` file to install your handler’s dependencies. You may get conflicts with other packages like Lightwood, but you can ignore them for now.

    5. Create a new blank class for your handler in the `{HandlerName}_handler.py` file. Like for other handlers, this should be a subclass of the `BaseMLEngine` class.

    6. Add your new handler class to the testing DB. In the `tests/unit/executor_test_base.py` file starting at line 91, you can see how other handlers are added with `db.session.add(...)`. Copy that and modify it to add your handler. Please note to add your handler before Lightwood, otherwise the CI will break.

    7. Run your new test. Please note that it should still fail but with a different exception message.
  </Accordion>

  <Accordion title="Step 4: Modify the handler source code until your test passes">
    1. Define a `create()` method that deals with the model setup arguments. This will add your handler to the models table. Depending on the framework, you may also train the model here using the `df` argument.

    2. Save relevant arguments/trained models at the end of your `create` method. This allows them to be accessed later. Use the `engine_storage` attributes; you can find examples in other handlers' folders.

    3. Define a `predict()` method that makes model predictions. This method must return a dataframe with format matching the input, except with a column containing your model’s predictions of the target. The input df is a subset of the original df with the rows determined by the conditions in the predict SQL query.

    4. Don’t debug the `create()` and `predict()` methods with the `print()` statement because they’re inside a subthread. Instead, write relevant info to disk.

    5. Once your first test passes, add new tests for any important cases. You can also add tests for any helper functions you write.
  </Accordion>

  <Accordion title="Step 5: QA your handler locally">
    1. Launch the MindsDB server locally with `python -m mindsdb`. Again, any issues will appear in the terminal output.

    2. Check that your handler has been added to the local server database. You can view the list of handlers with `SELECT * from information_schema.handlers`.

    3. Run the relevant tutorial from the panel on the right side. For regular data, this is `Predict Home Rental Prices`. And for time series data, this is `Forecast Quarterly House Sales`. Specify `USING ENGINE={your_handler}` while creating a model.

    4. Don’t debug the `create()` and `predict()` methods with the `print()` statement because they’re inside a subthread. Instead, write relevant info to disk.

    5. You should get sensible results if your handler has been well-implemented. Make sure you try the predict step with a range of parameters.
  </Accordion>

  <Accordion title="Step 6: Open a pull request">
    1. You need to fork the MindsDB repository. Follow [this guide](https://github.com/mindsdb/mindsdb/blob/main/CONTRIBUTING.md) to start a PR.

    2. If relevant, add your tests and new dependencies to the CI config. This is at `.github/workflows/mindsdb.yml`.
  </Accordion>
</AccordionGroup>

<Note>
  Please note that `pytest` is the recommended testing package. Use `pytest` to confirm your ML handler implementation is correct.
</Note>

<Tip>
  **Templates for Unit Tests**

  If you implement a time-series ML handler, create your unit tests following the structure of the [StatsForecast unit tests](https://github.com/mindsdb/mindsdb/blob/main/tests/unit/ml_handlers/test_statsforecast.py).

  If you implement an NLP ML handler, create your unit tests following the structure of the [Hugging Face unit tests](https://github.com/mindsdb/mindsdb/blob/main/tests/unit/ml_handlers/test_huggingface.py).
</Tip>

## Check out our Machine Learning Handlers!

To see some ML handlers that are currently in use, we encourage you to check out the following ML handlers inside the MindsDB repository:

* [Lightwood](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/lightwood_handler)
* [HuggingFace](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/huggingface_handler)
* [Ludwig](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/ludwig_handler)
* [OpenAI](https://github.com/mindsdb/mindsdb/blob/main/mindsdb/integrations/handlers/openai_handler)

And here are [all the handlers available in the MindsDB repository](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers).

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

Please note that the `USING` clause is optional, as it depends on the AI/ML handler whether it requires some arguments or not. Here, we created an OpenAI engine and provided own API key.

After creating your ML engine, you can create a model like this:

```sql
CREATE MODEL my_model
PREDICT answer
USING 
    engine = 'my_openai_engine',
    prompt_template = 'ask a question to a model'
```

The `USING` clause specifies the ML engine to be used for creating a new model.


# Amazon Bedrock

This documentation describes the integration of MindsDB with [Amazon Bedrock](https://aws.amazon.com/bedrock/), a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies.
The integration allows for the deployment of models offered by Amazon Bedrock within MindsDB, providing the models with access to data from various data sources.

## Prerequisites

Before proceeding, ensure the following prerequisites are met:

1. Install MindsDB locally via [Docker](https://docs.mindsdb.com/setup/self-hosted/docker) or [Docker Desktop](https://docs.mindsdb.com/setup/self-hosted/docker-desktop).
2. To use Amaon Bedrock within MindsDB, install the required dependencies following [this instruction](/setup/self-hosted/docker#install-dependencies).
3. Obtain the AWS credentials for a user with access to the Amazon Bedrock service.

## Setup

Create an AI engine from the [Amazon Bedrock handler](https://github.com/mindsdb/mindsdb/tree/main/mindsdb/integrations/handlers/bedrock_handler).

```sql
CREATE ML_ENGINE bedrock_engine
FROM bedrock
USING
    aws_access_key_id = 'AQAXEQK89OX07YS34OP',
    aws_secret_access_key = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    aws_session_token = 'FwoGZXIvYXdzEJr...',
    region_name = 'us-east-1';
```

Required parameters for creating an engine include the following:

- `aws_access_key_id`: The AWS access key ID for the user.
- `aws_secret_access_key`: The AWS secret access key for the user.
- `region_name`: The AWS region to use.

Optional parameters include the following:

- `aws_session_token`: The AWS session token for the user. This is required when using temporary security credentials.

Create a model using `bedrock_engine` as an engine.

```sql
CREATE MODEL bedrock_model
PREDICT answer
USING
    engine = 'bedrock_engine',
    question_column = 'question',
    max_tokens = 100,
    temperature = 0.3;
```

Required parameters for creating a model include the following:

- `engine`: The name of the engine created via `CREATE ML_ENGINE`.

Optional parameters include the following:

- `mode`: The mode to run inference in. The default mode is `default` and the other supported mode is `conversational`.
- `model_id`: The model ID to use for inference. The default model ID is `amazon.titan-text-premier-v1:0` and a list of other supported models can be found https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html.
- `question_column`: The column that stores the user input.
- `context_column`: The column that stores context to the user input.
- `prompt_template`: A template for the prompt with placeholders to be replaced by the user input.
- `max_tokens`: The maximum number of tokens to be generated in the model's responses.
- `temperature`: The likelihood of the model selecting higher-probability options while generating a response.
- `top_p`: The percentage of most-likely candidates that the model considers for the next token.
- `stop`: A list of tokens that the model should stop generating at.

<Tip>
For the `default` and `conversational` modes, one of the following need to be provided:
    * `prompt_template`.
    * `question_column`, and an optional `context_column`.
</Tip>

## Usage

### Default Mode

In the `default` mode, the model will generate a separate response for each input provided. No context is maintained between the inputs.

```sql
CREATE MODEL bedrock_default_model
PREDICT answer
USING
    engine = 'bedrock_engine',
    prompt_template = 'Answer the users input in a helpful way: {{question}}';
```

To generate a response for a single input, the following query can be used:

```sql
SELECT *
FROM bedrock_default_model
WHERE question = 'What is the capital of Sweden?';
```

The response will look like the following:

| question                       | answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is the capital of Sweden? | The capital of Sweden is Stockholm. Stockholm is the largest city in Sweden, with a population of over 900,000 people in the city proper and over 2 million in the metropolitan area. It is known for its beautiful architecture, scenic waterways, and rich cultural heritage. The city is built on 14 islands, which are connected by over 50 bridges, and is home to many museums, galleries, and historic landmarks. Some of the most famous attractions in Stockholm include the Vasa Museum, the Stockholm Palace, and the Old Town (Gamla Stan). |

To generate responses for multiple inputs, the following query can be used:

```sql
SELECT *
FROM files.unrelated_questions AS d
JOIN bedrock_default_model AS m
```

The response will look like the following:

| question                                       | answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is the capital of Sweden?                 | The capital of Sweden is Stockholm. Stockholm is the most populated city in Sweden with over 975,000 residents. The city is known for its stunning architecture and beautiful waterways.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| What is the second planet in the solar system? | The second planet from the sun in our solar system is Venus. Venus is often called Earth's "sister planet" because of their similar size, mass, and density. However, the two planets have very different atmospheres and surface conditions. Venus has a thick, toxic atmosphere composed of carbon dioxide, which traps heat and causes the planet to have surface temperatures that can reach up to 471 degrees Celsius (880 degrees Fahrenheit). Venus also has a highly reflective cloud cover that obscures its surface, making it difficult to study. Despite these challenges, Venus has been the subject of numerous scientific missions, including several orbiters and landers that have provided valuable insights into the planet's geology, atmosphere, and climate. |

<Tip>
`files.unrelated_questions` is a simple CSV file containing a `question` column (as expected by the above model) that has been uploaded to MindsDB. It is, however, possible to use any other supported data source in the same manner.
</Tip>

### Conversational Mode

In the `conversational` mode, the model will maintain context between the inputs and generate a single response. This response will be placed in the last row of the result set.

```sql
CREATE MODEL bedrock_conversational_model
PREDICT answer
USING
    engine = 'bedrock_engine',
    mode = 'conversational',
    question_column = 'question';
```

The syntax for generating responses in the `conversational` mode is the same as in the `default` mode.

However, when generating responses for multiple inputs, the difference between the two modes becomes apparent. As mentioned above, the `conversational` mode maintains context between the inputs and generates a single response, which is placed in the last row of the result set:

```sql
SELECT *
FROM files.related_questions AS d
JOIN bedrock_default_model AS m
```

This is what the response will look like:

| question                                  | answer                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is the capital of Sweden?            | [NULL]                                                                                                                                                                                                                                                                                                                                                                                                               |
| What are some cool places to visit there? | The capital of Sweden is Stockholm. It’s a beautiful city, with lots of old buildings and a scenic waterfront. You should definitely visit the Royal Palace, which is the largest palace in Scandinavia. You can also visit the Vasa Museum, which has a famous 17th-century warship that sank in Stockholm harbor. And you should definitely check out the ABBA Museum, which is dedicated to the famous pop group. |



# Predict Customer Churn with MindsDB

<Note>
  This tutorial uses the Lightwood integration that requires the `mindsdb/mindsdb:lightwood` Docker image. [Learn more here](/setup/self-hosted/docker#install-mindsdb).
</Note>

## Introduction

In this tutorial, we'll create and train a machine learning model, or as we call
it, an `AI Table` or a `predictor`. By querying the model, we'll predict the
probability of churn for new customers of a telecoms company.

Install MindsDB locally via [Docker](/setup/self-hosted/docker) or [Docker Desktop](/setup/self-hosted/docker-desktop).

Let's get started.

## Data Setup

### Connecting the Data

There are a couple of ways you can get the data to follow through with this
tutorial.

<Tabs>
  <Tab title="Connecting as a database">
    You can connect to a demo database that we've prepared for you. It contains the data used throughout this tutorial (the `example_db.demo_data.customer_churn` table).

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

    Now you can run queries directly on the demo database. Let's preview the data that we'll use to train our predictor.

    ```sql
    SELECT *
    FROM example_db.demo_data.customer_churn
    LIMIT 10;
    ```
  </Tab>

  <Tab title="Connecting as a file">
    You can download [the `CSV` data file here](https://github.com/mindsdb/mindsdb-examples/blob/master/classics/customer_churn/raw_data/WA_Fn-UseC_-Telco-Customer-Churn.csv) and upload it via [MindsDB SQL Editor](/connect/mindsdb_editor/).

    Follow [this guide](/sql/create/file/) to find out how to upload a file to MindsDB.

    Now you can run queries directly on the file as if it were a table. Let's preview the data that we'll use to train our predictor.

    ```sql
    SELECT *
    FROM files.churn
    LIMIT 10;
    ```
  </Tab>
</Tabs>

<Warning>
  **Pay Attention to the Queries**
  From now on, we'll use the
  `files.churn` file as a table. Make sure you replace it with
  `example_db.demo_data.customer_churn` if you connect the data as a database.
</Warning>

### Understanding the Data

We use the customer churn dataset, where each row is one customer, to predict
whether the customer is going to stop using the company products.

Below is the sample data stored in the `files.churn` table.

```sql
+----------+------+-------------+-------+----------+------+------------+----------------+---------------+--------------+------------+----------------+-----------+-----------+---------------+--------------+----------------+-------------------------+--------------+------------+-----+
|customerID|gender|SeniorCitizen|Partner|Dependents|tenure|PhoneService|MultipleLines   |InternetService|OnlineSecurity|OnlineBackup|DeviceProtection|TechSupport|StreamingTV|StreamingMovies|Contract      |PaperlessBilling|PaymentMethod            |MonthlyCharges|TotalCharges|Churn|
+----------+------+-------------+-------+----------+------+------------+----------------+---------------+--------------+------------+----------------+-----------+-----------+---------------+--------------+----------------+-------------------------+--------------+------------+-----+
|7590-VHVEG|Female|0            |Yes    |No        |1     |No          |No phone service|DSL            |No            |Yes         |No              |No         |No         |No             |Month-to-month|Yes             |Electronic check         |29.85         |29.85       |No   |
|5575-GNVDE|Male  |0            |No     |No        |34    |Yes         |No              |DSL            |Yes           |No          |Yes             |No         |No         |No             |One year      |No              |Mailed check             |56.95         |1889.5      |No   |
|3668-QPYBK|Male  |0            |No     |No        |2     |Yes         |No              |DSL            |Yes           |Yes         |No              |No         |No         |No             |Month-to-month|Yes             |Mailed check             |53.85         |108.15      |Yes  |
|7795-CFOCW|Male  |0            |No     |No        |45    |No          |No phone service|DSL            |Yes           |No          |Yes             |Yes        |No         |No             |One year      |No              |Bank transfer (automatic)|42.3          |1840.75     |No   |
|9237-HQITU|Female|0            |No     |No        |2     |Yes         |No              |Fiber optic    |No            |No          |No              |No         |No         |No             |Month-to-month|Yes             |Electronic check         |70.7          |151.65      |Yes  |
+----------+------+-------------+-------+----------+------+------------+----------------+---------------+--------------+------------+----------------+-----------+-----------+---------------+--------------+----------------+-------------------------+--------------+------------+-----+
```

Where:

| Column             | Description                                                                                                             | Data Type           | Usage   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------- | ------- |
| `CustomerId`       | The identification number of a customer.                                                                                | `character varying` | Feature |
| `Gender`           | The gender of a customer.                                                                                               | `character varying` | Feature |
| `SeniorCitizen`    | It indicates whether the customer is a senior citizen (`1`) or not (`0`).                                               | `integer`           | Feature |
| `Partner`          | It indicates whether the customer has a partner (`Yes`) or not (`No`).                                                  | `character varying` | Feature |
| `Dependents`       | It indicates whether the customer has dependents (`Yes`) or not (`No`).                                                 | `character varying` | Feature |
| `Tenure`           | Number of months the customer has been staying with the company.                                                        | `integer`           | Feature |
| `PhoneService`     | It indicates whether the customer has a phone service (`Yes`) or not (`No`).                                            | `character varying` | Feature |
| `MultipleLines`    | It indicates whether the customer has multiple lines (`Yes`) or not (`No`, `No phone service`).                         | `character varying` | Feature |
| `InternetService`  | Customer’s internet service provider (`DSL`, `Fiber optic`, `No`).                                                      | `character varying` | Feature |
| `OnlineSecurity`   | It indicates whether the customer has online security (`Yes`) or not (`No`, `No internet service`).                     | `character varying` | Feature |
| `OnlineBackup`     | It indicates whether the customer has online backup (`Yes`) or not (`No`, `No internet service`).                       | `character varying` | Feature |
| `DeviceProtection` | It indicates whether the customer has device protection (`Yes`) or not (`No`, `No internet service`).                   | `character varying` | Feature |
| `TechSupport`      | It indicates whether the customer has tech support (`Yes`) or not (`No`, `No internet service`).                        | `character varying` | Feature |
| `StreamingTv`      | It indicates whether the customer has streaming TV (`Yes`) or not (`No`, `No internet service`).                        | `character varying` | Feature |
| `StreamingMovies`  | It indicates whether the customer has streaming movies (`Yes`) or not (`No`, `No internet service`).                    | `character varying` | Feature |
| `Contract`         | The contract term of the customer (`Month-to-month`, `One year`, `Two year`).                                           | `character varying` | Feature |
| `PaperlessBilling` | It indicates whether the customer has paperless billing (`Yes`) or not (`No`).                                          | `character varying` | Feature |
| `PaymentMethod`    | Customer’s payment method (`Electronic check`, `Mailed check`, `Bank transfer (automatic)`, `Credit card (automatic)`). | `character varying` | Feature |
| `MonthlyCharges`   | The monthly charge amount.                                                                                              | `money`             | Feature |
| `TotalCharges`     | The total amount charged to the customer.                                                                               | `money`             | Feature |
| `Churn`            | It indicates whether the customer churned (`Yes`) or not (`No`).                                                        | `character varying` | Label   |

<Info>
  **Labels and Features**

  A **label** is a column whose values will be predicted (the y variable in simple
  linear regression).

  A **feature** is a column used to train the model (the x variable in simple
  linear regression).
</Info>

## Training a Predictor

Let's create and train the machine learning model. For that, we use the
[`CREATE MODEL`](/sql/create/model) statement and specify the
input columns used to train `FROM` (features) and what we want to
`PREDICT` (labels).

```sql
CREATE MODEL mindsdb.customer_churn_predictor
FROM files
  (SELECT * FROM churn)
PREDICT Churn;
```

We use all of the columns as features, except for the `Churn` column, whose
values will be predicted.

## Status of a Predictor

A predictor may take a couple of minutes for the training to complete. You can
monitor the status of the predictor by using this SQL command:

```sql
DESCRIBE customer_churn_predictor;
```

If we run it right after creating a predictor, we get this output:

```sql
+------------+
| status     |
+------------+
| generating |
+------------+
```

A bit later, this is the output:

```sql
+----------+
| status   |
+----------+
| training |
+----------+
```

And at last, this should be the output:

```sql
+----------+
| status   |
+----------+
| complete |
+----------+
```

Now, if the status of our predictor says `complete`, we can start making
predictions!

## Making Predictions

### Making a Single Prediction

You can make predictions by querying the predictor as if it were a table. The
[`SELECT`](/sql/api/select/) statement lets you make predictions for the label
based on the chosen features.

```sql
SELECT Churn, Churn_confidence, Churn_explain
FROM mindsdb.customer_churn_predictor
WHERE SeniorCitizen=0
AND Partner='Yes'
AND Dependents='No'
AND tenure=1
AND PhoneService='No'
AND MultipleLines='No phone service'
AND InternetService='DSL';
```

On execution, we get:

```sql
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Churn | Churn_confidence    | Churn_explain                                                                                                                                                    |
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Yes   | 0.7752808988764045  | {"predicted_value": "Yes", "confidence": 0.7752808988764045, "anomaly": null, "truth": null, "probability_class_No": 0.4756, "probability_class_Yes": 0.5244}    |
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

To get more accurate predictions, we should provide as much data as possible in
the `WHERE` clause. Let's run another query.

```sql
SELECT Churn, Churn_confidence, Churn_explain
FROM mindsdb.customer_churn_predictor
WHERE SeniorCitizen=0
AND Partner='Yes'
AND Dependents='No'
AND tenure=1
AND PhoneService='No'
AND MultipleLines='No phone service'
AND InternetService='DSL'
AND Contract='Month-to-month'
AND MonthlyCharges=29.85
AND TotalCharges=29.85
AND OnlineBackup='Yes'
AND OnlineSecurity='No'
AND DeviceProtection='No'
AND TechSupport='No'
AND StreamingTV='No'
AND StreamingMovies='No'
AND PaperlessBilling='Yes'
AND PaymentMethod='Electronic check';
```

On execution, we get:

```sql
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Churn | Churn_confidence    | Churn_explain                                                                                                                                                    |
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| Yes   | 0.8202247191011236  | {"predicted_value": "Yes", "confidence": 0.8202247191011236, "anomaly": null, "truth": null, "probability_class_No": 0.4098, "probability_class_Yes": 0.5902}    |
+-------+---------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------+
```

MindsDB predicted the probability of this customer churning with confidence of
around 82%. The previous query predicted it with confidence of around 79%. So
providing more data improved the confidence level of predictions.

### Making Batch Predictions

Also, you can make bulk predictions by joining a data table with your predictor
using [`JOIN`](/sql/api/join).

```sql
SELECT t.customerID, t.Contract, t.MonthlyCharges, m.Churn
FROM files.churn AS t
JOIN mindsdb.customer_churn_predictor AS m
LIMIT 100;
```

On execution, we get:

```sql
+----------------+-------------------+------------------+---------+
| customerID     | Contract          | MonthlyCharges   | Churn   |
+----------------+-------------------+------------------+---------+
| 7590-VHVEG     | Month-to-month    | 29.85            | Yes     |
| 5575-GNVDE     | One year          | 56.95            | No      |
| 3668-QPYBK     | Month-to-month    | 53.85            | Yes     |
| 7795-CFOCW     | One year          | 42.3             | No      |
| 9237-HQITU     | Month-to-month    | 70.7             | Yes     |
+----------------+-------------------+------------------+---------+
```

## What's Next?

Have fun while trying it out yourself!

* Bookmark [MindsDB repository on GitHub](https://github.com/mindsdb/mindsdb).
* Install MindsDB locally via [Docker](/setup/self-hosted/docker) or [Docker Desktop](/setup/self-hosted/docker-desktop).
* Engage with the MindsDB community on
  [Slack](https://mindsdb.com/joincommunity) or
  [GitHub](https://github.com/mindsdb/mindsdb/discussions) to ask questions and
  share your ideas and thoughts.

If this tutorial was helpful, please give us a GitHub star
[here](https://github.com/mindsdb/mindsdb).

# How to Persist Predictions

MindsDB provides a range of options for persisting predictions and forecasts. Let's explore all possibilities to save the prediction results.

<Note>
  **Reasons to Save Predictions**

  Every time you want to get predictions, you need to query the model, usually joined with an input data table, like this:

  ```sql
  SELECT input.product_name, input.review, output.sentiment
  FROM mysql_demo_db.amazon_reviews AS input
  JOIN sentiment_classifier AS output;
  ```

  However, querying the model returns the result set that is not persistent by default. For future use, it is recommended to persist the result set instead of querying the model again with the same data.

  MindsDB enables you to save predictions into a view or a table or download as a CSV file.
</Note>

## Creating a View

After creating the model, you can save the prediction results into a view.

```sql
CREATE VIEW review_sentiment (

    -- querying for predictions
    SELECT input.product_name, input.review, output.sentiment
    FROM mysql_demo_db.amazon_reviews AS input
    JOIN sentiment_classifier AS output
    LIMIT 10

);
```

Now the `review_sentiment` view stores sentiment predictions made for all customer reviews.

<Tip>
  Here is a [comprehensive tutorial](/nlp/sentiment-analysis-inside-mysql-with-openai) on how to predict sentiment of customer reviews using OpenAI.
</Tip>

## Creating a Table

After creating the model, you can save predictions into a database table.

```sql
CREATE TABLE local_postgres.question_answers (

    -- querying for predictions
    SELECT input.article_title, input.question, output.answer
    FROM mysql_demo_db.questions AS input
    JOIN question_answering_model AS output
    LIMIT 10

);
```

Here, the `local_postgres` database is a PostgreSQL database connected to MindsDB with a user that has the write access.

Now the `question_answers` table stores all prediction results.

<Tip>
  Here is a [comprehensive tutorial](/nlp/question-answering-inside-mysql-with-openai) on how to answer questions using OpenAI.
</Tip>

## Downloading a CSV File

After executing the `SELECT` statement, you can download the output as a CSV file.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=14df4b723b94fabec86ebe03a2f8d59e" data-og-width="1131" width="1131" data-og-height="206" height="206" data-path="assets/faqs_download.csv.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=280&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=c47af3168b84da408ac876e633b8e955 280w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=560&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=f2c4df6ce7c9ee81df44c77f3ce33455 560w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=840&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=f95988562fc2cc1681c682ea7d98ff6a 840w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=1100&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=4c6f5e5e4ea76e112792f8750891c858 1100w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=1650&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=7371b3618d901549211010fe14a402c1 1650w, https://mintcdn.com/mindsdb/U8_C23ppbMIBDBSs/assets/faqs_download.csv.png?w=2500&fit=max&auto=format&n=U8_C23ppbMIBDBSs&q=85&s=60864d456904c35ff7bd0a33eb36db4c 2500w" />
</p>

Click the `Export` button and choose the `CSV` option.

# Get a Single Prediction

## Description

The `SELECT` statement fetches predictions from the model table. The data is returned on the fly and the result set is not persisted.

But there are ways to save predictions data! You can save your predictions as a view using the [`CREATE VIEW`](/sql/create/view/) statement. Please note that a view is a saved query and does not store data like a table. Another way is to create a table using the [`CREATE TABLE`](/sql/create/table/) statement or insert your predictions into an existing table using the [`INSERT INTO`](/sql/api/insert/) statement.

## Syntax

Here is the syntax for fetching a single prediction from the model table:

```sql
SELECT target_name, target_name_explain
FROM mindsdb.predictor_name
WHERE column_name = value 
AND column_name = value;
```

<Warning>
  **Grammar Matters**

  Here are some points to keep in mind while writing queries in MindsDB:<br />
     1. The `column_name = value` pairs may be joined by `AND` or `OR` keywords.<br />
     2. Do not use any quotations for numerical values.<br />
     3. Use single quotes for strings.
     4. The tables and column names are case sensitive.
</Warning>

On execution, we get:

```sql
+-------------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
| target_name       | target_name_explain                                                                                                                           |
+-------------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
| predicted_value   | {"predicted_value": 4394, "confidence": 0.99, "anomaly": null, "truth": null, "confidence_lower_bound": 4313, "confidence_upper_bound": 4475} |
+-------------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
```

Where:

| Name                                | Description                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `target_name`                       | Name of the column to be predicted.                                                                                                                                                  |
| `target_name_explain`               | Object of the JSON type that contains the `predicted_value` and additional information such as `confidence`, `anomaly`, `truth`, `confidence_lower_bound`, `confidence_upper_bound`. |
| `predictor_name`                    | Name of the model used to make the prediction.                                                                                                                                       |
| `WHERE column_name = value AND ...` | `WHERE` clause used to pass the data values for which the prediction is made.                                                                                                        |

## Example

Let's predict the `rental_price` value using the `home_rentals_model` model for the property having `sqft=823`, `location='good'`, `neighborhood='downtown'`, and `days_on_market=10`.

```sql
SELECT sqft, location, neighborhood, days_on_market, rental_price, rental_price_explain
FROM mindsdb.home_rentals_model1
WHERE sqft=823
AND location='good'
AND neighborhood='downtown'
AND days_on_market=10;
```

On execution, we get:

```sql
+-------+----------+--------------+----------------+--------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
| sqft  | location | neighborhood | days_on_market | rental_price | rental_price_explain                                                                                                                          |
+-------+----------+--------------+----------------+--------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
| 823   | good     | downtown     | 10             | 4394         | {"predicted_value": 4394, "confidence": 0.99, "anomaly": null, "truth": null, "confidence_lower_bound": 4313, "confidence_upper_bound": 4475} |
+-------+----------+--------------+----------------+--------------+-----------------------------------------------------------------------------------------------------------------------------------------------+
```


# Get Batch Predictions

## Description

The `SELECT` statement fetches predictions from the model table. The data is returned on the fly and the result set is not persisted.

But there are ways to save predictions data! You can save your predictions as a view using the [`CREATE VIEW`](/sql/create/view/) statement. Please note that a view is a saved query and does not store data like a table. Another way is to create a table using the [`CREATE TABLE`](/sql/create/table/) statement or insert your predictions into an existing table using the [`INSERT INTO`](/sql/api/insert/) statement.

## Syntax

Here is the syntax for making batch predictions by joining one or more data source tables with one or more model tables:

```sql
SELECT t1.column, t2.column, m1.target, m2.target
FROM integration_name.table_name1 AS t1
JOIN integration_name.table_name2 AS t2 ON t1.column = t2.column
JOIN ...
JOIN mindsdb.model_name1 AS m1
JOIN mindsdb.model_name2 AS m2
JOIN ...
[ON t1.input_data = m1.expected_argument]
WHERE m1.parameter = 'value'
AND m2.parameter = 'value';
```

Where:

* There are the data tables that provide input to the models: `integration_name.table_name1`, `integration_name.table_name2`.
* These are the AI tables: `mindsdb.model_name1`, `mindsdb.model_name2`.

Note that you can provide input to the models from the data tables and also in the `WHERE` clause.

<Tip>
  When querying for predictions, you can specify the `partition_size` parameter to split data into partitions and run prediction on different workers. Note that the [ML task queue](/setup/custom-config#overview-of-config-parameters) needs to be enabled to use this parameter.

  To use the `partition_size` parameter, provide it in the `USING` clause, specifying the partition size, like this:

  ```
  ...
  USING partition_size=100
  ```
</Tip>

<Tip>
  Follow [this doc page](/generative-ai-tables) to learn more about AI Tables.
</Tip>

## Example

Let's make bulk predictions to predict the `rental_price` value using the `home_rentals_model` model joined with the data source table.

```sql
SELECT t.sqft, t.location, t.neighborhood, t.days_on_market, t.rental_price AS real_price,
       m.rental_price AS predicted_rental_price
FROM example_db.demo_data.home_rentals AS t
JOIN mindsdb.home_rentals_model AS m
LIMIT 5;
```

On execution, we get:

```sql
+-------+----------+-----------------+----------------+--------------+-----------------------------+
| sqft  | location | neighborhood    | days_on_market | real_price   | predicted_rental_price      |
+-------+----------+-----------------+----------------+--------------+-----------------------------+
| 917   | great    | berkeley_hills  | 13             | 3901         | 3886                        |
| 194   | great    | berkeley_hills  | 10             | 2042         | 2007                        |
| 543   | poor     | westbrae        | 18             | 1871         | 1865                        |
| 503   | good     | downtown        | 10             | 3026         | 3020                        |
| 1066  | good     | thowsand_oaks   | 13             | 4774         | 4748                        |
+-------+----------+-----------------+----------------+--------------+-----------------------------+
```

<Tip>
  Follow [this doc page](/generative-ai-tables#working-with-generative-ai-tables) to see examples of joining multiple data table with multiple models.
</Tip>



# Lightwood

Lightwood is the default AI engine used in MindsDB. It deals mainly with [classification](/sql/tutorials/customer-churn), [regression](/sql/tutorials/home-rentals), and [time-series](/sql/tutorials/house-sales-forecasting) problems in machine learning.

By providing it with the input data and problem definition, Lightwood generates predictions following three core steps that include *Data pre-processing and cleaning*, *Feature engineering*, and *Model building and training*. The input data ranges from numbers, dates, categories, text, quantities, arrays, matrices, up to images, audios, and videos (passed as URLs).

<Tip>
  We recommend using the `mindsdb/mindsdb:lightwood` Docker image that comes with the Lightwood dependencies pre-installed. Learn more [here](/setup/self-hosted/docker).
</Tip>

## How It Works

Here is the algorithm followed by Lightwood starting from the input data setup, through model building and training, up to getting predictions.

<p align="center">
  <img src="https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=3a91335a4a47847fb921af832fabc82e" data-og-width="2000" width="2000" data-og-height="1125" height="1125" data-path="assets/lightwood.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=280&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=fcfc2a992995489344eaba6f4b06402c 280w, https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=560&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=9014104db4db2ea440d7c19f9a82b4f4 560w, https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=840&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=d0a141766d09dc3a97075110b47241ec 840w, https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=1100&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=20f959d24a41b8b5f9ba3fca52418717 1100w, https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=1650&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=c7aa7d443dc7fea316894efdec6d00b4 1650w, https://mintcdn.com/mindsdb/iK5MN5UH2_93kMSg/assets/lightwood.png?w=2500&fit=max&auto=format&n=iK5MN5UH2_93kMSg&q=85&s=db2c5018ac04b0fac08857621a80fbcc 2500w" />
</p>

The input data is pre-processed and each column is assigned a data type. Next, data is converted into features via *encoders* that transform data into numerical representation used by the model. Finally, a predictive model takes the encoded feature data and outputs a prediction for the target.

Under the hood, the model splits data into the training, validation, and testing sets, with ratios that are dynamic but usually an 80-10-10 ratio. The split is done by default using random sampling without replacement, stratified on the target column. Doing so, it determines the accuracy of the model by evaluating on the held out test set.

Users can either use [Lightwood’s default mixers/models](/integrations/ai-engines/lightwood#model-key) or create their own approaches inherited from the `BaseMixer` class.

To learn more about Lightwood philosophy, follow [this link](https://mindsdb.github.io/lightwood/lightwood_philosophy.html).

## Accuracy Metrics

Lightwood provides ways to score the accuracy of the model using one of the accuracy functions.

The accuracy functions include `mean_absolute_error`, `mean_squared_error`, `precision_score`, `recall_score`, and `f1_score`.

```sql
CREATE MODEL model_name
FROM data_source
  (SELECT * FROM table_name)
PREDICT target_column
USING
  accuracy_functions="['accuracy_function']";
```

You can define the accuracy function of choice in the `USING` clause of the `CREATE MODEL` statement.

<Note>
  Here are the accuracy functions used by default:

  * the `r2_score` value for regression predictions.
  * the `balanced_accuracy_score` value for classification predictions.
  * the `complementary_smape_array_accuracy` value for time series predictions.

  The values vary between 0 and 1, where 1 indicates a perfect predictor, based on results obtained for a held-out portion of data (i.e. testing set).

  You can check accuracy values for models using the [`DESCRIBE`](/sql/api/describe) statement.
</Note>

## Tuning the Lightwood ML Engine

### Description

In MindsDB, the underlying AutoML models are based on the [Lightwood](https://mindsdb.github.io/lightwood/index.html) engine by default. This library generates models automatically based on the data and declarative problem definition. But the default configuration can be overridden using the `USING` statement that provides an option to configure specific parameters of the training process.

In the upcoming version of MindsDB, it will be possible to choose from more ML frameworks. Please note that the Lightwood engine is used by default.

### Syntax

Here is the syntax:

```sql
CREATE MODEL project_name.model_name
FROM data_source
    (SELECT column_name, ... FROM table_name)
PREDICT target_column
USING parameter_key = 'parameter_value';
```

#### `encoders` Key

It grants access to configure how each column is encoded. By default, the AutoML engine tries to get the best match for the data.

```sql
...
USING encoders.column_name.module = 'value';
```

To learn more about `encoders` and their options, visit the [Lightwood documentation page on encoders](https://mindsdb.github.io/lightwood/encoder.html).

#### `model.args` Key

It allows you to specify the type of machine learning algorithm to learn from the encoder data.

```sql
...
USING model.args = {"key": value};
```

Here are the model options:

| Model                                                                               | Description                                                                                                                                                                                                                                                                     |   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | - |
| [BaseMixer](https://mindsdb.github.io/lightwood/mixer.html#mixer.BaseMixer)         | It is a base class for all mixers.                                                                                                                                                                                                                                              |   |
| [LightGBM](https://mindsdb.github.io/lightwood/mixer.html#mixer.LightGBM)           | This mixer configures and uses LightGBM for regression or classification tasks depending on the problem definition.                                                                                                                                                             |   |
| [LightGBMArray](https://mindsdb.github.io/lightwood/mixer.html#mixer.LightGBMArray) | This mixer consists of several LightGBM mixers in regression mode aimed at time series forecasting tasks.                                                                                                                                                                       |   |
| [NHitsMixer](https://mindsdb.github.io/lightwood/mixer.html#mixer.NHitsMixer)       | This mixer is a wrapper around an MQN-HITS deep learning model.                                                                                                                                                                                                                 |   |
| [Neural](https://mindsdb.github.io/lightwood/mixer.html#mixer.Neural)               | This mixer trains a fully connected dense network from concatenated encoded outputs of each feature in the dataset to predict the encoded output.                                                                                                                               |   |
| [NeuralTs](https://mindsdb.github.io/lightwood/mixer.html#mixer.NeuralTs)           | This mixer inherits from Neural mixer and should be used for time series forecasts.                                                                                                                                                                                             |   |
| [ProphetMixer](https://mindsdb.github.io/lightwood/mixer.html#mixer.ProphetMixer)   | This mixer is a wrapper around the popular time series library [Prophet](https://facebook.github.io/prophet/).                                                                                                                                                                  |   |
| [RandomForest](https://mindsdb.github.io/lightwood/mixer.html#mixer.RandomForest)   | This mixer supports both regression and classification tasks. It inherits from sklearn.ensemble.RandomForestRegressor and sklearn.ensemble.RandomForestClassifier.                                                                                                              |   |
| [Regression](https://mindsdb.github.io/lightwood/mixer.html#mixer.Regression)       | This mixer inherits from [scikit-learn’s Ridge class](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html).                                                                                                                                       |   |
| [SkTime](https://mindsdb.github.io/lightwood/mixer.html#mixer.SkTime)               | This mixer is a wrapper around the popular time series library sktime.                                                                                                                                                                                                          |   |
| [Unit](https://mindsdb.github.io/lightwood/mixer.html#mixer.Unit)                   | This is a special mixer that passes along whatever prediction is made by the target encoder without modifications. It is used for single-column predictive scenarios that may involve complex and/or expensive encoders (e.g. free-form text classification with transformers). |   |
| [XGBoostMixer](https://mindsdb.github.io/lightwood/mixer.html#mixer.XGBoostMixer)   | This mixer is a good all-rounder, due to the generally great performance of tree-based ML algorithms for supervised learning tasks with tabular data.                                                                                                                           |   |

<Note>
  Please note that not all mixers are available in our cloud environment. In particular, LightGBM, LightGBMArray, NHITS, and Prophet.
</Note>

To learn more about all the `model` options, visit the [Lightwood documentation page on mixers](https://mindsdb.github.io/lightwood/mixer.html).

#### `problem_definition.embedding_only` Key

To train an embedding-only model, use the below parameter when creating the model.

```sql
CREATE MODEL embedding_only_model
...
USING problem_definition.embedding_only = True;
```

The predictions made by this embedding model come in the form of embeddings by default.

Alternatively, to get predictions in the form of embeddings from a normal model (that is, trained without specifying the `problem_definition.embedding_only` parameter), use the below parameter when querying this model for predictions.

```sql
SELECT predictions
...
USING return_embedding = True;
```

#### Other Keys Supported by Lightwood in JsonAI

The most common use cases of configuring predictors use `encoders` and `model` keys explained above. To see all the available keys, check out the [Lightwood documentation page on JsonAI](https://mindsdb.github.io/lightwood/api/types.html#api.types.JsonAI).

### Example

Here we use the `home_rentals` dataset and specify particular `encoders` for some columns and a LightGBM `model`.

```sql
CREATE MODEL mindsdb.home_rentals_model
FROM example_db
    (SELECT * FROM demo_data.home_rentals)
PREDICT rental_price
USING
    encoders.location.module = 'CategoricalAutoEncoder',
    encoders.rental_price.module = 'NumericEncoder',
    encoders.rental_price.args.positive_domain = 'True',
    model.args = {"submodels": [
                    {"module": "LightGBM",
                     "args": {
                          "stop_after": 12,
                          "fit_on_dev": true
                          }
                    }
                ]};
```

## Explainability

With Lightwood, you can deploy the following types of models:

* regressions models,
* classification models,
* time-series models,
* embedding models.

Predictions made by each type of model come with an explanation column, as below.

<AccordionGroup>
  <Accordion title="Regression">
    In the case of regression models, the `target_explain` column contains the following information:

    ```
    {"predicted_value": 2951, "confidence": 0.99, "anomaly": null, "truth": null, "confidence_lower_bound": 2795, "confidence_upper_bound": 3107}
    ```

    <Note>
      The upper and lower bounds are determined via conformal prediction, and correspond to the reported confidence score (which can be modified by the user).
    </Note>

    Try it out following [this tutorial](/use-cases/in-database_ml/home-rentals).
  </Accordion>

  <Accordion title="Classification">
    In the case of classification models, the `target_explain` column contains the following information:

    ```
    {"predicted_value": "No", "confidence": 0.6629213483146067, "anomaly": null, "truth": null, "probability_class_No": 0.8561, "probability_class_Yes": 0.1439}
    ```

    <Note>
      The `confidence` score is produced by the conformal prediction module and is well-calibrated. On the other hand, the `probability_class` comes directly from the model logits, which may be uncalibrated. Therefore, the `probability_class` score may be optimistic or pessimistic, i.e. coverage is not guaranteed to empirically match the reported score.
    </Note>

    Try it out following [this tutorial](/use-cases/in-database_ml/customer-churn).
  </Accordion>

  <Accordion title="Time-Series">
    In the case of time-series models, the `target_explain` column contains the following information:

    ```
    {"predicted_value": 501618.3125, "confidence": 0.9991, "anomaly": false, "truth": null, "confidence_lower_bound": 500926.109375, "confidence_upper_bound": 502310.515625}
    ```

    Try it out following [this tutorial](/use-cases/predictive_analytics/house-sales-forecasting).
  </Accordion>

  <Accordion title="Embeddings">
    In the case of embeddings models, the `target_explain` column contains the following information:

    ```
    {"predicted_value": [1.0, 6.712956428527832, 1.247057318687439, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 2.3025851249694824, 0.5629426836967468, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.7540000081062317, 0.3333333432674408, 0.35483869910240173, 0.9583333134651184, 0.7833333611488342, 0.25], "confidence": null, "anomaly": null, "truth": null}
    ```

    Try it out following [this tutorial](/use-cases/ai-powered_data_retrieval/embedding-model).
  </Accordion>
</AccordionGroup>

<Note>
  You can visit the comprehensive [Lightwood docs here](https://mindsdb.github.io/lightwood/).
</Note>

<Tip>
  Check out the Lightwood tutorials [here](https://mindsdb.github.io/lightwood/tutorials.html).
</Tip>

# Generative AI Tables

MindsDB empowers organizations to harness the power of AI by abstracting AI models as Generative AI Tables. These tables are capable of learning from the input data and generating predictions from the underlying model upon being queried. This abstraction makes AI highly accessible, enabling development teams to use their existing SQL skills to build applications powered by AI.

<Tip>
  MindsDB integrates with numerous AI frameworks. [Learn more here](/integrations/ai-overview).
</Tip>

<p align="center">
  <img src="https://docs.google.com/drawings/d/e/2PACX-1vQDXTuCWl8IxTEO-2ntjN17B5XtCtJDJ_d_PDCeX0ch0GBzSJfuJmefGuM_FEyGOwlgrxnNSzmLaYGO/pub?w=951&h=460" />
</p>

## What are Generative AI Tables?

Generative AI is a subfield of artificial intelligence that trains AI models to create new content, such as realistic text, forecasts, images, and more, by learning patterns from existing data.

MindsDB revolutionizes machine learning within enterprise databases by introducing the concept of **Generative AI tables**. These essentially abstract AI models as virtual AI tables, capable of producing output when given certain input.

## How to Use Generative AI Tables

AI tables, introduced by MindsDB, abstract AI models as virtual tables so you can simply query AI models for predictions.

With MindsDB, you can join multiple AI tables (that abstract AI models) with multiple data tables (that provide input to the models) to get all predictions at once.

Let's look at some examples.

### Deploy AI Models as AI Tables

You can deploy an AI model as a virtual AI table using the `CREATE MODEL` statement.

Here we create a model that classifies sentiment of customer reviews as instructed in the prompt template message. The required input is the review and output is the sentiment predicted by the model.

```sql
CREATE MODEL sentiment_classifier_model
PREDICT sentiment
USING
    engine = 'openai_engine',
    model_name = 'gpt-4',
    prompt_template = 'describe the sentiment of the reviews
                        strictly as "positive", "neutral", or "negative".
                        "I love the product":positive
                        "It is a scam":negative
                        "{{review}}.":';
```

Next we create a model that generates responses to the reviews. The required input includes review, product name, and sold product quantity, and output is the response generated by the model.

```sql
CREATE MODEL response_generator_model
PREDICT response
USING
    engine = 'openai_engine',
    model_name = 'gpt-4',
    prompt_template = 'briefly respond to the customer review: {{review}}, added by a customer after buying {{product_name}} in quantity {{quantity}}';
```

<Info>
  Follow [this doc page](/integrations/ai-engines/openai) to configure the OpenAI engine in MindsDB.
</Info>

Now let's look at the data tables that we'll use to provide input data to the AI tables.

### Prepare Input Data

The `amazon_reviews` table stores the following columns:

```sql
+----------------------------+-----------------------------+------------------------+-------------+
| created_at                 | product_name                | review                 | customer_id |
+----------------------------+-----------------------------+------------------------+-------------+
| 2023-10-03 16:30:00.000000 | Power Adapter               | It is a great product. | 1           |
| 2023-10-03 16:31:00.000000 | Bluetooth and Wi-Fi Speaker | It is ok.              | 2           |
| 2023-10-03 16:32:00.000000 | Kindle eReader              | It doesn’t work.       | 3           |
+----------------------------+-----------------------------+------------------------+-------------+
```

It provides sufficient input data for the `sentiment_classifier_model`, but not for the `response_generator_model`.

The `products_sold` table stores the following columns:

```sql
+----------------------------+-----------------------------+-------------+----------+
| sale_date                  | product_name                | customer_id | quantity |
+----------------------------+-----------------------------+-------------+----------+
| 2023-10-03 16:30:00.000000 | Power Adapter               | 1           | 20       |
| 2023-10-03 16:31:00.000000 | Bluetooth and Wi-Fi Speaker | 2           | 5        |
| 2023-10-03 16:32:00.000000 | Kindle eReader              | 3           | 10       |
+----------------------------+-----------------------------+-------------+----------+
```

The `response_generator_model` requires the two tables to be joined to provide it with sufficient input data.

### Make Predictions

You can query the AI tables directly or join AI tables with data tables to get the predictions.

There are two ways you can provide input to the models:

1. If you query the AI table directly, you can provide input data in the `WHERE` clause, like this:

   ```sql
   SELECT review, sentiment
   FROM sentiment_classifier_model
   WHERE review = 'I like it';
   ```

2. You can provide input data to AI tables from the joined data tables, like this:

   ```sql
   SELECT inp.product_name,
         inp.review,
         m1.sentiment,
         m2.response
   FROM data_integration_conn.amazon_reviews2 AS inp
   JOIN data_integration_conn.products_sold AS inp2
   ON inp.customer_id = inp2.customer_id
   JOIN sentiment_classifier_model AS m1
   JOIN response_generator_model AS m2;
   ```

   The `sentiment_classifier_model` requires a parameter named `review`, so the data table should contain a column named `review`, which is picked up by the model.

   Note that, when joining data tables, you must provide the `ON` clause condition, which is implemented implicitly when joining the AI tables.

Moreover, you can combine these two options and provide the input data to the AI tables partially from the data tables and partially from the `WHERE` clause, like this:

```sql
SELECT inp.product_name,
       inp.review,
       m1.sentiment,
       m2.response
FROM data_integration_conn.amazon_reviews2 AS inp
JOIN sentiment_classifier_model AS m1
JOIN response_generator_model AS m2
WHERE m2.quantity = 5;
```

Here the `sentiment_classifier_model` takes input data from the `amazon_review` table, while the `response_generator_model` takes input data from the `amazon_reviews` table and from the `WHERE` clause.

Furthermore, you can make use of subqueries to provide input data to the models via the `WHERE` clause, like this:

```sql
SELECT inp.product_name,
       inp.review,
       m1.sentiment,
       m2.response
FROM data_integration_conn.amazon_reviews2 AS inp
JOIN sentiment_classifier_model AS m1
JOIN response_generator_model AS m2
WHERE m2.quantity = (SELECT quantity
                     FROM data_integration_conn.products_sold
                     WHERE customer_id = 2);
```

## Difference between AI Tables and Standard Tables

To understand the difference, let's go over a simpler example. Here we will see how traditional database tables are designed to give you a deterministic response given some input, and how Generative AI Tables are designed to generate an approximate response given some input.

Let’s consider the following `income_table` table that stores the `income` and `debt` values.

```sql
SELECT income, debt
FROM income_table;
```

On execution, we get:

```sql
+------+-----+
|income|debt |
+------+-----+
|60000 |20000|
|80000 |25100|
|100000|30040|
|120000|36010|
+------+-----+
```

A simple visualization of the data present in the `income_table` table is as follows:

<img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=99568615b5ba258b5f8d19055ee51dfd" alt="Income vs Debt" data-og-width="1548" width="1548" data-og-height="800" height="800" data-path="assets/sql/income_vs_debt.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=808454cf90d059e5c8f4c48b3dc2e8ce 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=beb7cd81bf22a6c260d90be87bae38d7 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=51643372a4fd79199d5855f7837b995e 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=b7f65a7ae3fec419394079bb591b68b5 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=a857695965638f0592d1ba0e7fca0c6b 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=10b4f3b7ec4b9f77f41a82c091777081 2500w" />

Querying the income table to get the `debt` value for a particular `income` value results in the following:

```sql
SELECT income, debt
FROM income_table
WHERE income = 80000;
```

On execution, we get:

```sql
+------+-----+
|income|debt |
+------+-----+
|80000 |25100|
+------+-----+
```

And here is what we get:

<img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=4d49a413f5cae096a0e70238907aec2f" alt="Income vs Debt chart" data-og-width="1548" width="1548" data-og-height="800" height="800" data-path="assets/sql/income_vs_debt_known_value.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=068b5dd67a2302b8628d6cafdd3f7a41 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=c28322964dc194f67ef2456697880bf1 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=3983d180ae5661ae334def33e51e5280 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=3ecb651a15e33e8749f061a162d74a7c 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=5c006d41e70c720e07efc79149678944 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_known_value.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=b9fe5ae22e93e980850318b54cad48a9 2500w" />

But what happens when querying the table for an `income` value that is not
present there?

```sql
SELECT income, debt
FROM income_table
WHERE income = 90000;
```

On execution, we get:

```sql
Empty set (0.00 sec)
```

When the `WHERE` clause condition is not fulfilled for any of the rows, no value is returned.

<img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=cf59e87769f5f7886f285b8daab58a5c" alt="Income vs Debt query" data-og-width="1548" width="1548" data-og-height="800" height="800" data-path="assets/sql/income_vs_debt_unknown_value.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=9eebceafdd136ad74b31df9202edab56 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=17220f296a010f853a896c0dd825a8f0 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=7067f30e2b3117eae5166219ffa20fe3 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=6765dfa34fe18761fca55cf70d2b06e5 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=bee574c3250cad3b6f071ece397293db 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_unknown_value.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=fd3e110cc61f63bdba0039787ce9e44b 2500w" />

When a table doesn’t have an exact match, the query returns an empty set or null value. This is where the AI Tables come into play!

Let’s create a `debt_model` model that allows us to approximate the `debt` value for any `income` value. We train the `debt_model` model using the data from the `income_table` table.

```sql
CREATE MODEL mindsdb.debt_model
FROM income_table
PREDICT debt;
```

On execution, we get:

```sql
Query OK, 0 rows affected (x.xxx sec)
```

MindsDB provides the [`CREATE MODEL`](/sql/create/model/) statement. On execution of this statement, the predictive model works in the background, automatically creating a vector representation of the data that can be visualized as follows:

<img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=9cd7761ab1d3be3c53696e530c7f27dc" alt="Income vs Debt model" data-og-width="1548" width="1548" data-og-height="800" height="800" data-path="assets/sql/income_vs_debt_predictor.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=aa3c43d7b4150cbab314725d8864a7ea 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=c9ef5460ae97f4df4558998551604ecd 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=ab4be4be2d8ee7dc0f81e8c8294b42f9 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=4943e6a13a6e2b579d95822cda3d37ff 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=dd9dbcaafaa2a6c5d7468213dcd2c020 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_predictor.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=fd33c9f1cdf4be2c11708711944c99e2 2500w" />

Let’s now look for the `debt` value of some random `income` value. To get the approximated `debt` value, we query the `mindsdb.debt_model` model instead of the `income_table` table.

```sql
SELECT income, debt
FROM mindsdb.debt_model
WHERE income = 90000;
```

On execution, we get:

```sql
+------+-----+
|income|debt |
+------+-----+
|90000 |27820|
+------+-----+
```

And here is how it looks:

<img src="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=3bce609b189a0aa493efcde8211e655a" alt="Income vs Debt model" data-og-width="1548" width="1548" data-og-height="800" height="800" data-path="assets/sql/income_vs_debt_prediction.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=280&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=e30787a9f9e7ad4cd9ac0945d50b3baa 280w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=560&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=3985504567369a0551b71235e71a0b8c 560w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=840&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=ae73867e6389db8bfc12a7505ce282e3 840w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=1100&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=cffb4b678006c9f007e80745d49e4324 1100w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=1650&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=a7e3609e0dafb7232f36358456cf134d 1650w, https://mintcdn.com/mindsdb/qZ0qlWEqCb1K2Drt/assets/sql/income_vs_debt_prediction.png?w=2500&fit=max&auto=format&n=qZ0qlWEqCb1K2Drt&q=85&s=32c9b58fa9a634e836f9f0d76aed74a7 2500w" />


