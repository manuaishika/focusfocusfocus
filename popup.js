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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const PERMANENT_TASKS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskUrls', 'websiteActivity', 'taskTypes', 'websiteActivityDurations', 'archive']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const websiteActivityDurations = result.websiteActivityDurations || {};
      const taskTypes = result.taskTypes || {};
      const archive = result.archive || {};
      const todayProgress = progress[today] || {};
      const todayActivity = websiteActivity[today] || {};
      const todayDurations = websiteActivityDurations[today] || {};
      const yesterdayProgress = progress[yesterdayStr] || {};
      const yesterdayActivity = websiteActivity[yesterdayStr] || {};
      const yesterdayArchive = archive[yesterdayStr] || [];
      
      // Find tasks that were incomplete yesterday AND are carried over
      // Only one-time tasks that were incomplete yesterday should show "Past Work"
      // Permanent tasks should NEVER get "Past Work" badge
      const carriedOverTasks = allTasks.filter(task => {
        // NEVER label permanent tasks
        if (PERMANENT_TASKS.includes(task)) {
          return false;
        }
        
        const taskType = taskTypes[task] || 'daily';
        
        // Only one-time tasks can be "carried over" - daily tasks always show
        if (taskType !== 'onetime') {
          return false;
        }
        
        const taskUrl = taskUrls[task] || '';
        
        // Check if task was completed yesterday (check archive first, then progress/activity)
        const wasCompletedYesterday = yesterdayArchive.includes(task) ||
          (taskUrl && taskUrl.trim() !== ''
            ? (yesterdayActivity[task] === true || yesterdayProgress[task] === true)
            : (yesterdayProgress[task] === true));
        
        // If it was completed yesterday, it shouldn't get "Past Work" badge
        if (wasCompletedYesterday) {
          return false;
        }
        
        // For one-time tasks: if they're showing today and weren't completed yesterday,
        // they're either from yesterday (incomplete) or added today (new)
        // We'll mark ALL one-time tasks that weren't completed yesterday as "Past Work"
        // unless they appear in today's data but not yesterday's (new today)
        
        // Check if task appeared in yesterday's data
        const appearedYesterday = yesterdayArchive.includes(task) ||
          (taskUrl && taskUrl.trim() !== ''
            ? (yesterdayActivity[task] !== undefined || yesterdayProgress[task] !== undefined)
            : (yesterdayProgress[task] !== undefined));
        
        // Check if task appears in today's data
        const appearsToday = archive[today]?.includes(task) ||
          (taskUrl && taskUrl.trim() !== ''
            ? (todayActivity[task] !== undefined || todayProgress[task] !== undefined)
            : (todayProgress[task] !== undefined));
        
        // If it appeared yesterday and wasn't completed, it's definitely "Past Work"
        if (appearedYesterday && !wasCompletedYesterday) {
          return true;
        }
        
        // If it appears in today's data but NOT in yesterday's, it's new today - don't mark as "Past Work"
        if (appearsToday && !appearedYesterday) {
          return false;
        }
        
        // If it doesn't appear in today's data and didn't appear in yesterday's,
        // it's likely from yesterday but never interacted with - mark as "Past Work"
        // This is a heuristic: one-time tasks that exist but have no interaction history
        // are likely carried over from previous days
        if (!appearsToday && !appearedYesterday) {
          return true; // Likely from yesterday, mark as "Past Work"
        }
        
        // Default: if it appeared yesterday and wasn't completed, it's "Past Work"
        return appearedYesterday && !wasCompletedYesterday;
      });
      
      // Active tasks logic:
      // - Permanent tasks: ALWAYS show (LeetCode, GRE Practice, ML Practice, Maths)
      // - Daily tasks: always show (permanent)
      // - One-time tasks: remove if completed on ANY PAST DAY (including yesterday)
      // - Completed tasks stay in list with strikethrough ONLY if completed TODAY
      const activeTasks = allTasks.filter(task => {
        const taskType = taskTypes[task] || 'daily';
        const taskUrl = taskUrls[task] || '';
        const isPermanentTask = PERMANENT_TASKS.includes(task);
        
        // Permanent tasks: ALWAYS show (never remove)
        if (isPermanentTask) {
          return true;
        }
        
        // Daily tasks: always show (permanent)
        if (taskType === 'daily') {
          return true; // Always show daily tasks
        }
        
        // For ONE-TIME tasks ONLY: check if completed on ANY past day
        // FIRST: Check if task is completed TODAY - if so, keep it (show with strikethrough)
        const isCompletedToday = archive[today]?.includes(task) ||
          (taskUrl && taskUrl.trim() !== ''
            ? (todayActivity[task] === true || todayProgress[task] === true)
            : (todayProgress[task] === true));
        
        if (isCompletedToday) {
          return true; // Keep - completed today, show with strikethrough
        }
        
        // SECOND: Check ALL past days (including yesterday) - if completed on ANY past day, REMOVE
        const allPastArchiveDates = Object.keys(archive).filter(date => date < today);
        const allPastProgressDates = Object.keys(progress).filter(date => date < today);
        const allPastActivityDates = Object.keys(websiteActivity).filter(date => date < today);
        
        // Check archive for ALL past days
        for (const date of allPastArchiveDates) {
          if (archive[date]?.includes(task)) {
            return false; // Remove - was completed on a past day
          }
        }
        
        // Check progress for ALL past days (for manual tasks)
        for (const date of allPastProgressDates) {
          if (progress[date]?.[task] === true) {
            return false; // Remove - was completed on a past day
          }
        }
        
        // Check activity for ALL past days (for URL tasks)
        if (taskUrl && taskUrl.trim() !== '') {
          for (const date of allPastActivityDates) {
            if (websiteActivity[date]?.[task] === true) {
              return false; // Remove - was completed on a past day
            }
          }
        }
        
        // Keep if: incomplete (carry forward) or new today
        return true;
      });
      
      // Calculate progress percentage (count all active tasks, including completed ones)
      const totalTasks = activeTasks.length; // x = total active tasks
      const completedTasks = activeTasks.filter(task => {
        const isPermanentTask = PERMANENT_TASKS.includes(task);
        const taskUrl = taskUrls[task] || '';
        const isManuallyCompleted = todayProgress[task] === true;
        const hasActivity = !isPermanentTask && todayActivity[task] === true;
        
        // Permanent tasks: check only manual completion
        if (isPermanentTask) {
          return isManuallyCompleted;
        }
        
        // Other tasks: check activity or manual completion
        if (taskUrl && taskUrl.trim() !== '') {
          return hasActivity || isManuallyCompleted;
        } else {
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
        
        // Show all active tasks (daily tasks always shown, one-time tasks only if incomplete)
        activeTasks.forEach(task => {
          const isCarriedOver = carriedOverTasks.includes(task);
          const taskItem = createTaskItem(task, taskTypes, taskUrls, todayProgress, todayActivity, todayDurations, isCarriedOver);
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
  
  function createTaskItem(task, taskTypes, taskUrls, todayProgress, todayActivity, todayDurations, isCarriedOver = false) {
    const taskType = taskTypes[task] || 'daily';
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `task-${task}`;
    
    const taskUrl = taskUrls[task] || '';
    const isPermanentTask = PERMANENT_TASKS.includes(task);
    
    // For permanent tasks: treat as manual checkbox (no activity tracking)
    // For other tasks: check if they have URL and activity tracking
    const hasActivity = !isPermanentTask && todayActivity[task] === true;
    const timeSpent = todayDurations[task] || 0;
    const minutesSpent = Math.round(timeSpent / 1000 / 60);
    
    // Determine if task is completed:
    // - Permanent tasks: completed if todayProgress[task] is true (manual checkbox only)
    // - Tasks with URLs (non-permanent): completed if hasActivity (10+ min)
    // - Tasks without URLs: completed if todayProgress[task] is true (manual checkbox)
    const isCompleted = isPermanentTask
      ? (todayProgress[task] === true)
      : (taskUrl && taskUrl.trim() !== '' 
          ? hasActivity 
          : (todayProgress[task] === true));
    
    checkbox.checked = isCompleted;
    
    const label = document.createElement('label');
    label.htmlFor = `task-${task}`;
    
    const taskName = document.createElement('span');
    taskName.textContent = task;
    
    // Show "Past Work" badge for tasks carried over from previous days
    if (isCarriedOver) {
      const pastWorkBadge = document.createElement('span');
      pastWorkBadge.style.cssText = 'background: #00072D; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; font-weight: 500;';
      pastWorkBadge.textContent = 'Past Work';
      taskName.appendChild(pastWorkBadge);
    }
    
    // Show task type badge ONLY for one-time tasks (not for daily/permanent)
    if (taskType === 'onetime') {
      const badge = document.createElement('span');
      badge.style.cssText = 'background: #00072D; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px; font-weight: 500;';
      badge.textContent = 'One-Time';
      taskName.appendChild(badge);
    }
    
    label.appendChild(taskName);
    
    // Handle tasks with URLs (but NOT permanent tasks - they're always manual)
    if (!isPermanentTask && taskUrl && taskUrl.trim() !== '') {
      if (!hasActivity) {
        // Task has URL but no activity - disable checkbox and show progress
        checkbox.disabled = true;
        taskItem.classList.add('disabled');
        const status = document.createElement('span');
        status.className = 'activity-status';
        if (minutesSpent > 0) {
          status.textContent = ` (${minutesSpent} min - ${Math.round((timeSpent / (10 * 60 * 1000)) * 100)}%)`;
          status.style.color = '#00072D';
        } else {
          status.textContent = ' (No activity)';
          status.style.color = '#00072D';
        }
        status.style.fontSize = '9px';
        label.appendChild(status);
      } else {
        // Task has URL and activity - checkbox is enabled and checked
        checkbox.disabled = false;
        const status = document.createElement('span');
        status.className = 'activity-status';
        status.textContent = ` ✓ (${minutesSpent} min)`;
        status.style.color = '#00072D';
        status.style.fontSize = '9px';
        label.appendChild(status);
      }
    }
    // Permanent tasks: always allow manual checkbox (no URL tracking)

    if (isCompleted) {
      taskItem.classList.add('completed');
    }

    checkbox.addEventListener('change', async () => {
      try {
        // Permanent tasks: always allow manual checkbox
        // Non-permanent tasks with URLs: completion is based on activity, not manual checkbox
        if (!isPermanentTask && taskUrl && taskUrl.trim() !== '') {
          // Task has URL - completion is controlled by activity only
          checkbox.checked = hasActivity; // Reset to activity state
          return;
        }
        
        // For permanent tasks or tasks without URLs, allow manual checkbox
        const result = await chrome.storage.local.get(['progress', 'archive']);
        const progress = result.progress || {};
        const archive = result.archive || {};
        if (!progress[today]) {
          progress[today] = {};
        }
        progress[today][task] = checkbox.checked;
        
        // If task is completed, add to archive
        if (checkbox.checked) {
          if (!archive[today]) {
            archive[today] = [];
          }
          // Add to archive if not already there
          if (!archive[today].includes(task)) {
            archive[today].push(task);
          }
          taskItem.classList.add('completed');
        } else {
          taskItem.classList.remove('completed');
          // Remove from archive if unchecked
          if (archive[today]) {
            archive[today] = archive[today].filter(t => t !== task);
          }
        }

        await chrome.storage.local.set({ progress, archive });
        loadData(); // Reload to update UI and recalculate percentage
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    });

    // Add right-click context menu
    taskItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, task, taskItem);
    });

    taskItem.appendChild(checkbox);
    taskItem.appendChild(label);
    return taskItem;
  }
  
  function showContextMenu(event, task, taskItem) {
    // Remove existing context menu if any
    const existingMenu = document.getElementById('task-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // Get the popup container
    const container = document.querySelector('.container');
    if (!container) return;
    
    // Get position relative to container
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.id = 'task-context-menu';
    contextMenu.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      min-width: 120px;
      padding: 4px 0;
    `;
    
    // Remove option
    const removeOption = document.createElement('div');
    removeOption.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      font-size: 12px;
      color: #333;
      user-select: none;
    `;
    removeOption.textContent = 'Remove';
    removeOption.addEventListener('mouseenter', () => {
      removeOption.style.background = '#f0f0f0';
    });
    removeOption.addEventListener('mouseleave', () => {
      removeOption.style.background = 'white';
    });
    removeOption.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeTask(task);
      contextMenu.remove();
    });
    
    contextMenu.appendChild(removeOption);
    container.appendChild(contextMenu);
    
    // Remove menu when clicking outside or on another context menu
    const closeMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu, true);
        document.removeEventListener('contextmenu', closeMenu, true);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu, true);
      document.addEventListener('contextmenu', closeMenu, true);
    }, 0);
  }
  
  async function removeTask(taskName) {
    try {
      const result = await chrome.storage.local.get(['tasks', 'permanentTasks', 'taskUrls', 'taskTypes', 'progress', 'archive']);
      const tasks = result.tasks || [];
      const permanentTasks = result.permanentTasks || PERMANENT_TASKS;
      const taskUrls = result.taskUrls || {};
      const taskTypes = result.taskTypes || {};
      const progress = result.progress || {};
      const archive = result.archive || {};
      
      // Check if it's a permanent task
      if (permanentTasks.includes(taskName)) {
        // Remove from permanent tasks
        const updatedPermanentTasks = permanentTasks.filter(t => t !== taskName);
        await chrome.storage.local.set({ permanentTasks: updatedPermanentTasks });
      } else {
        // Remove from custom tasks
        const updatedTasks = tasks.filter(t => t !== taskName);
        await chrome.storage.local.set({ tasks: updatedTasks });
      }
      
      // Clean up related data
      delete taskUrls[taskName];
      delete taskTypes[taskName];
      
      // Remove from today's progress and archive
      if (progress[today] && progress[today][taskName] !== undefined) {
        delete progress[today][taskName];
      }
      if (archive[today]) {
        archive[today] = archive[today].filter(t => t !== taskName);
      }
      
      await chrome.storage.local.set({ 
        taskUrls, 
        taskTypes, 
        progress, 
        archive 
      });
      
      // Reload data to update UI
      loadData();
    } catch (error) {
      console.error('Error removing task:', error);
      alert('Error removing task. Please try again.');
    }
  }
  
  // Also archive tasks when they're completed via activity
  async function archiveCompletedTask(taskName) {
    try {
      const result = await chrome.storage.local.get(['archive']);
      const archive = result.archive || {};
      if (!archive[today]) {
        archive[today] = [];
      }
      if (!archive[today].includes(taskName)) {
        archive[today].push(taskName);
        await chrome.storage.local.set({ archive });
      }
    } catch (error) {
      console.error('Error archiving task:', error);
    }
  }
  
  // Monitor activity changes and archive when tasks complete
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.websiteActivity) {
      const newActivity = changes.websiteActivity.newValue || {};
      const oldActivity = changes.websiteActivity.oldValue || {};
      const todayActivity = newActivity[today] || {};
      const oldTodayActivity = oldActivity[today] || {};
      
      // Check if any task just got marked as active
      Object.keys(todayActivity).forEach(task => {
        if (todayActivity[task] === true && oldTodayActivity[task] !== true) {
          // Task just completed via activity
          archiveCompletedTask(task);
          // Reload to update UI
          setTimeout(() => loadData(), 500);
        }
      });
    }
  });

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
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'onetime';
      
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

          if (taskTypeSelect) {
            taskTypeSelect.value = 'onetime';
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

