import * as async from 'async';
import { AsyncTask } from './types/interface/AsyncTask';
export const Cargo = (() => {
  let taskResults: Map<number, any> = new Map();
  let taskCount = 0;
  let tasksCompleted = 0;

  let cargo = async.cargo((tasks: AsyncTask[]) => {
    tasks.forEach((task: AsyncTask) => {
      task.task((err: any, result: any) => {
        if (err) {
          console.error(`AsyncTask failed with error: ${err}`);
        } else {
          // Add the result to taskResults Map
          console.log('task', task);
          taskResults.set(task.index, result);
          while (taskResults.get(tasksCompleted) !== undefined) {
            console.log(
              `Finished task: ${taskResults.get(
                tasksCompleted
              )} at position: ${tasksCompleted}`
            );

            tasksCompleted++;
            // send audio to twilio
          }
        }
      });
    });
  }, 10); // Set payload to 2

  const asyncTask = async (callback: any) => {
    setTimeout(() => callback(null, 'audio data'), 1000 * Math.random());
  };

  // You can add tasks to the cargo anytime you want. Here's an example:
  setInterval(() => {
    while (taskCount < 10) {
      cargo.push({
        index: taskCount++,
        task: asyncTask,
      });
    }
  }, 3000);
})();
