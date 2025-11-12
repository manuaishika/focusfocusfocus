document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');
  const toggleAddTaskBtn = document.getElementById('toggle-add-task');
  const addTaskForm = document.getElementById('add-task-form');
  const newTaskInput = document.getElementById('new-task-input');
  const taskTypeSelect = document.getElementById('task-type-select');
  const addTaskBtn = document.getElementById('add-task-btn');

  if (!chrome || !chrome.storage) {
    if (tasksList) {
      tasksList.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const PERMANENT_TASKS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskUrls', 'websiteActivity', 'taskTypes', 'websiteActivityDurations']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const websiteActivityDurations = result.websiteActivityDurations || {};
      const taskTypes = result.taskTypes || {};
      const todayProgress = progress[today] || {};
      const todayActivity = websiteActivity[today] || {};
      const todayDurations = websiteActivityDurations[today] || {};

      // Calculate progress percentage
      // Count ALL tasks (daily + one-time) for total
      // Count completed tasks (can be completed via activity OR manual checkbox)
      const totalTasks = allTasks.length; // x = total tasks (all types)
      const completedTasks = allTasks.filter(task => {
        const taskUrl = taskUrls[task] || '';
        // Check if task is manually marked as complete (checkbox checked)
        const isManuallyCompleted = todayProgress[task] === true;
        // Check if task has activity (for URL-based tasks)
        const hasActivity = todayActivity[task] === true;
        
        if (taskUrl && taskUrl.trim() !== '') {
          // For tasks with URLs, completed if has activity OR manually checked
          return hasActivity || isManuallyCompleted;
        } else {
          // For manual tasks, completed if checkbox is checked
          return isManuallyCompleted;
        }
      });
      
      // Calculate percentage: (completed / total) * 100
      const completedCount = completedTasks.length; // y = completed tasks
      const progressPercentage = totalTasks > 0 
        ? Math.round((completedCount / totalTasks) * 100)
        : 0;
      
      // Ensure percentage is between 0 and 100
      const finalPercentage = Math.min(100, Math.max(0, progressPercentage));
      
      // Update progress indicator
      const progressIndicator = document.getElementById('progress-indicator');
      if (progressIndicator) {
        progressIndicator.innerHTML = `
          <div class="progress-percentage">${finalPercentage}% Complete</div>
          <div class="progress-text">${completedCount} of ${totalTasks} tasks</div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${finalPercentage}%"></div>
          </div>
        `;
      }

      if (tasksList) {
        tasksList.innerHTML = '';

        allTasks.forEach(task => {
          const taskType = taskTypes[task] || 'daily';
          const taskItem = document.createElement('div');
          taskItem.className = 'task-item';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `task-${task}`;
          
          const taskUrl = taskUrls[task] || '';
          const hasActivity = todayActivity[task] === true;
          const timeSpent = todayDurations[task] || 0;
          const minutesSpent = Math.round(timeSpent / 1000 / 60);
          
          // Determine if task is completed:
          // - Tasks with URLs: completed if hasActivity (10+ min)
          // - Tasks without URLs: completed if todayProgress[task] is true (manual checkbox)
          const isCompleted = taskUrl && taskUrl.trim() !== '' 
            ? hasActivity 
            : (todayProgress[task] === true);
          
          checkbox.checked = isCompleted;
          
          const label = document.createElement('label');
          label.htmlFor = `task-${task}`;
          
          const taskName = document.createElement('span');
          taskName.textContent = task;
          
          // Show task type badge for custom tasks
          if (taskType === 'onetime') {
            const badge = document.createElement('span');
            badge.style.cssText = 'background: #FF9800; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; font-weight: 500;';
            badge.textContent = 'One-Time';
            taskName.appendChild(badge);
          }
          
          label.appendChild(taskName);
          
          // Handle tasks with URLs
          if (taskUrl && taskUrl.trim() !== '') {
            if (!hasActivity) {
              // Task has URL but no activity - disable checkbox and show progress
              checkbox.disabled = true;
              taskItem.classList.add('disabled');
              const status = document.createElement('span');
              status.className = 'activity-status';
              if (minutesSpent > 0) {
                status.textContent = ` (${minutesSpent} min - ${Math.round((timeSpent / (10 * 60 * 1000)) * 100)}%)`;
                status.style.color = '#FF9800';
              } else {
                status.textContent = ' (No activity)';
                status.style.color = '#f44336';
              }
              status.style.fontSize = '9px';
              label.appendChild(status);
            } else {
              // Task has URL and activity - checkbox is enabled and checked
              checkbox.disabled = false;
              const status = document.createElement('span');
              status.className = 'activity-status';
              status.textContent = ` ✓ (${minutesSpent} min)`;
              status.style.color = '#4CAF50';
              status.style.fontSize = '9px';
              label.appendChild(status);
            }
          }

          if (isCompleted) {
            taskItem.classList.add('completed');
          }

          checkbox.addEventListener('change', async () => {
            try {
              // For tasks with URLs, completion is based on activity, not manual checkbox
              // Only allow manual checkbox for tasks without URLs
              if (taskUrl && taskUrl.trim() !== '') {
                // Task has URL - completion is controlled by activity only
                checkbox.checked = hasActivity; // Reset to activity state
                return;
              }
              
              // For tasks without URLs, allow manual checkbox
              const result = await chrome.storage.local.get(['progress']);
              const progress = result.progress || {};
              if (!progress[today]) {
                progress[today] = {};
              }
              progress[today][task] = checkbox.checked;
              
              if (checkbox.checked) {
                taskItem.classList.add('completed');
              } else {
                taskItem.classList.remove('completed');
              }

              await chrome.storage.local.set({ progress });
              loadData(); // Reload to update UI and recalculate percentage
            } catch (error) {
              console.error('Error saving progress:', error);
            }
          });

          taskItem.appendChild(checkbox);
          taskItem.appendChild(label);
          tasksList.appendChild(taskItem);
        });
      }
    } catch (error) {
      if (tasksList) {
        tasksList.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading data:', error);
    }
  }

  if (viewHeatmapBtn) {
    viewHeatmapBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('heatmap.html') });
    });
  }

  const viewArchiveBtn = document.getElementById('view-archive');

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (viewArchiveBtn) {
    viewArchiveBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
    });
  }

  // Toggle add task form
  if (toggleAddTaskBtn && addTaskForm) {
    toggleAddTaskBtn.addEventListener('click', () => {
      addTaskForm.classList.toggle('hidden');
      if (!addTaskForm.classList.contains('hidden') && newTaskInput) {
        newTaskInput.focus();
      }
    });
  }

  // Add task functionality
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'daily';
      
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks', 'taskUrls', 'taskTypes', 'permanentTasks']);
          const tasks = result.tasks || [];
          const taskUrls = result.taskUrls || {};
          const taskTypes = result.taskTypes || {};
          const permanentTasks = result.permanentTasks || PERMANENT_TASKS;
          
          // Check if task already exists (in permanent or custom)
          const allTasks = [...permanentTasks, ...tasks];
          if (allTasks.includes(taskName)) {
            alert('Task already exists!');
            return;
          }
          
          // Add new task
          tasks.push(taskName);
          taskUrls[taskName] = ''; // Initialize with empty URL
          taskTypes[taskName] = taskType;
          
          await chrome.storage.local.set({ tasks, taskUrls, taskTypes });
          
          // Clear input and hide form
          if (newTaskInput) {
            newTaskInput.value = '';
          }
          if (addTaskForm) {
            addTaskForm.classList.add('hidden');
          }
          
          // Reload data to show new task
          loadData();
        } catch (error) {
          console.error('Error adding task:', error);
          alert('Error adding task. Please try again.');
        }
      }
    });
  }

  // Allow Enter key to add task
  if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && addTaskBtn) {
        addTaskBtn.click();
      }
    });
  }

  loadData();
  
  // Refresh data every 30 seconds to show updated progress
  setInterval(() => {
    loadData();
  }, 30000);
});

