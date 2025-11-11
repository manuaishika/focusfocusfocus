document.addEventListener('DOMContentLoaded', async () => {
  const tasksContainer = document.getElementById('tasks-container');
  const newTaskInput = document.getElementById('new-task-input');
  const addTaskBtn = document.getElementById('add-task-btn');

  if (!chrome || !chrome.storage) {
    if (tasksContainer) {
      tasksContainer.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  async function loadTasks() {
    try {
      const result = await chrome.storage.local.get(['tasks']);
      const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
      renderTasks(tasks);
    } catch (error) {
      if (tasksContainer) {
        tasksContainer.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading tasks:', error);
    }
  }

  function renderTasks(tasks) {
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row';
      
      const span = document.createElement('span');
      span.textContent = task;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        try {
          const result = await chrome.storage.local.get(['tasks', 'progress']);
          const tasks = result.tasks || [];
          const progress = result.progress || {};
          const updatedTasks = tasks.filter(t => t !== task);
          
          // Clean up progress data for deleted task
          Object.keys(progress).forEach(date => {
            if (progress[date] && progress[date][task]) {
              delete progress[date][task];
              // Remove date entry if no tasks remain
              if (Object.keys(progress[date]).length === 0) {
                delete progress[date];
              }
            }
          });
          
          await chrome.storage.local.set({ tasks: updatedTasks, progress });
          renderTasks(updatedTasks);
        } catch (error) {
          console.error('Error deleting task:', error);
        }
      });

      taskRow.appendChild(span);
      taskRow.appendChild(deleteBtn);
      tasksContainer.appendChild(taskRow);
    });
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks']);
          const tasks = result.tasks || [];
          if (!tasks.includes(taskName)) {
            tasks.push(taskName);
            await chrome.storage.local.set({ tasks });
            renderTasks(tasks);
            if (newTaskInput) {
              newTaskInput.value = '';
            }
          }
        } catch (error) {
          console.error('Error adding task:', error);
        }
      }
    });
  }

  if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && addTaskBtn) {
        addTaskBtn.click();
      }
    });
  }

  loadTasks();
});

