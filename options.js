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
      const result = await chrome.storage.local.get(['tasks', 'taskUrls']);
      const tasks = result.tasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const taskUrls = result.taskUrls || {};
      renderTasks(tasks, taskUrls);
    } catch (error) {
      if (tasksContainer) {
        tasksContainer.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading tasks:', error);
    }
  }

  function renderTasks(tasks, taskUrls) {
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row';
      
      const taskHeader = document.createElement('div');
      taskHeader.className = 'task-header';
      
      const taskName = document.createElement('span');
      taskName.className = 'task-name';
      taskName.textContent = task;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        try {
          const result = await chrome.storage.local.get(['tasks', 'progress', 'taskUrls']);
          const tasks = result.tasks || [];
          const progress = result.progress || {};
          const taskUrls = result.taskUrls || {};
          const updatedTasks = tasks.filter(t => t !== task);
          
          // Clean up progress data for deleted task
          Object.keys(progress).forEach(date => {
            if (progress[date] && progress[date][task]) {
              delete progress[date][task];
              if (Object.keys(progress[date]).length === 0) {
                delete progress[date];
              }
            }
          });
          
          // Clean up task URL
          delete taskUrls[task];
          
          await chrome.storage.local.set({ tasks: updatedTasks, progress, taskUrls });
          renderTasks(updatedTasks, taskUrls);
        } catch (error) {
          console.error('Error deleting task:', error);
        }
      });

      taskHeader.appendChild(taskName);
      taskHeader.appendChild(deleteBtn);
      taskRow.appendChild(taskHeader);

      // URL input section
      const urlSection = document.createElement('div');
      urlSection.className = 'task-url-section';
      
      const urlLabel = document.createElement('label');
      urlLabel.textContent = 'Website URL:';
      
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'https://example.com (leave empty for manual tracking)';
      urlInput.value = taskUrls[task] || '';
      urlInput.addEventListener('change', async () => {
        try {
          const result = await chrome.storage.local.get(['taskUrls']);
          const taskUrls = result.taskUrls || {};
          taskUrls[task] = urlInput.value.trim();
          await chrome.storage.local.set({ taskUrls });
        } catch (error) {
          console.error('Error saving task URL:', error);
        }
      });
      
      urlSection.appendChild(urlLabel);
      urlSection.appendChild(urlInput);
      taskRow.appendChild(urlSection);
      
      tasksContainer.appendChild(taskRow);
    });
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks', 'taskUrls']);
          const tasks = result.tasks || [];
          const taskUrls = result.taskUrls || {};
          if (!tasks.includes(taskName)) {
            tasks.push(taskName);
            taskUrls[taskName] = ''; // Initialize with empty URL
            await chrome.storage.local.set({ tasks, taskUrls });
            renderTasks(tasks, taskUrls);
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

