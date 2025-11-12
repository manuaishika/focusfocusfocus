document.addEventListener('DOMContentLoaded', async () => {
  const permanentTasksContainer = document.getElementById('permanent-tasks-container');
  const tasksContainer = document.getElementById('tasks-container');
  const newTaskInput = document.getElementById('new-task-input');
  const taskTypeSelect = document.getElementById('task-type-select');
  const addTaskBtn = document.getElementById('add-task-btn');

  if (!chrome || !chrome.storage) {
    if (tasksContainer) {
      tasksContainer.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const PERMANENT_TASKS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  async function loadTasks() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'taskUrls', 'taskTypes']);
      const permanentTasks = result.permanentTasks || PERMANENT_TASKS;
      const tasks = result.tasks || [];
      const taskUrls = result.taskUrls || {};
      const taskTypes = result.taskTypes || {};
      
      renderPermanentTasks(permanentTasks, taskUrls, taskTypes);
      renderTasks(tasks, taskUrls, taskTypes);
    } catch (error) {
      if (tasksContainer) {
        tasksContainer.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading tasks:', error);
    }
  }

  function renderPermanentTasks(permanentTasks, taskUrls, taskTypes) {
    if (!permanentTasksContainer) return;
    permanentTasksContainer.innerHTML = '';
    
    permanentTasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row permanent-task-row';
      
      const taskHeader = document.createElement('div');
      taskHeader.className = 'task-header';
      
      const taskName = document.createElement('span');
      taskName.className = 'task-name';
      taskName.textContent = task;
      
      const permanentBadge = document.createElement('span');
      permanentBadge.className = 'task-type-badge task-type-daily';
      permanentBadge.textContent = 'Permanent';
      taskName.appendChild(permanentBadge);

      taskHeader.appendChild(taskName);
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
      
      permanentTasksContainer.appendChild(taskRow);
    });
  }

  function renderTasks(tasks, taskUrls, taskTypes) {
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';
    
    // Filter out permanent tasks from custom tasks
    const customTasks = tasks.filter(t => !PERMANENT_TASKS.includes(t));
    
    customTasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row';
      
      const taskHeader = document.createElement('div');
      taskHeader.className = 'task-header';
      
      const taskName = document.createElement('span');
      taskName.className = 'task-name';
      taskName.textContent = task;
      
      // Show task type badge
      const taskType = taskTypes[task] || 'daily';
      const typeBadge = document.createElement('span');
      typeBadge.className = `task-type-badge task-type-${taskType}`;
      typeBadge.textContent = taskType === 'daily' ? 'Daily' : 'One-Time';
      taskName.appendChild(typeBadge);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        try {
          const result = await chrome.storage.local.get(['tasks', 'progress', 'taskUrls', 'taskTypes']);
          const tasks = result.tasks || [];
          const progress = result.progress || {};
          const taskUrls = result.taskUrls || {};
          const taskTypes = result.taskTypes || {};
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
          
          // Clean up task URL and type
          delete taskUrls[task];
          delete taskTypes[task];
          
          await chrome.storage.local.set({ tasks: updatedTasks, progress, taskUrls, taskTypes });
          renderTasks(updatedTasks, taskUrls, taskTypes);
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
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'daily';
      
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks', 'taskUrls', 'taskTypes']);
          const tasks = result.tasks || [];
          const taskUrls = result.taskUrls || {};
          const taskTypes = result.taskTypes || {};
          
          if (!tasks.includes(taskName) && !PERMANENT_TASKS.includes(taskName)) {
            tasks.push(taskName);
            taskUrls[taskName] = ''; // Initialize with empty URL
            taskTypes[taskName] = taskType;
            await chrome.storage.local.set({ tasks, taskUrls, taskTypes });
            renderTasks(tasks, taskUrls, taskTypes);
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
