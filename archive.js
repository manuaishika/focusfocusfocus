document.addEventListener('DOMContentLoaded', async () => {
  const archiveContainer = document.getElementById('archive-container');
  const filterDate = document.getElementById('filter-date');
  const clearFilterBtn = document.getElementById('clear-filter');

  if (!chrome || !chrome.storage) {
    if (archiveContainer) {
      archiveContainer.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  async function loadArchive(selectedDate = null) {
    try {
      const result = await chrome.storage.local.get(['archive', 'progress', 'websiteActivity', 'permanentTasks', 'tasks', 'taskTypes', 'taskUrls']);
      const archive = result.archive || {};
      const progress = result.progress || {};
      const websiteActivity = result.websiteActivity || {};
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const taskTypes = result.taskTypes || {};
      const taskUrls = result.taskUrls || {};

      if (archiveContainer) {
        archiveContainer.innerHTML = '';

        // Get all dates from progress and archive, combine them
        const progressDates = Object.keys(progress).sort().reverse();
        const archiveDates = Object.keys(archive).sort().reverse();
        const allDates = [...new Set([...progressDates, ...archiveDates])].sort().reverse();
        
        // Calculate statistics from all dates (past and present)
        const totalDays = allDates.length;
        let totalCompletions = 0;
        let totalTasks = 0; // Track total tasks across all days
        const taskCounts = {};
        const dailyStats = []; // Store tasks and completions per day
        
        allDates.forEach(date => {
          // Get completed tasks: prefer archive, then check progress/activity
          let completedTasks = [];
          if (archive[date] && archive[date].length > 0) {
            completedTasks = archive[date];
          } else {
            // Fall back to progress/activity data
            const dateProgress = progress[date] || {};
            const dateActivity = websiteActivity[date] || {};
            completedTasks = allTasks.filter(task => {
              const taskUrl = taskUrls[task] || '';
              if (taskUrl && taskUrl.trim() !== '') {
                return dateActivity[task] === true || dateProgress[task] === true;
              } else {
                return dateProgress[task] === true;
              }
            });
          }
          
          // Count total tasks for this day (all tasks that existed on this day)
          // This includes both completed and incomplete tasks
          const dateProgress = progress[date] || {};
          const dateActivity = websiteActivity[date] || {};
          
          // For today, use the current task list (all active tasks)
          // For past days, reconstruct what tasks existed
          const today = new Date().toISOString().split('T')[0];
          let tasksOnThisDay = [];
          
          if (date === today) {
            // For today, count all current tasks (daily + one-time that haven't been removed)
            tasksOnThisDay = allTasks.filter(task => {
              const taskType = taskTypes[task] || 'daily';
              if (taskType === 'daily') return true;
              // For one-time tasks, check if they were completed yesterday
              const taskUrl = taskUrls[task] || '';
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];
              const yesterdayProgress = progress[yesterdayStr] || {};
              const yesterdayActivity = websiteActivity[yesterdayStr] || {};
              const wasCompletedYesterday = taskUrl && taskUrl.trim() !== ''
                ? (yesterdayActivity[task] === true || yesterdayProgress[task] === true)
                : (yesterdayProgress[task] === true);
              return !wasCompletedYesterday; // Show if not completed yesterday
            });
          } else {
            // For past days, count:
            // 1. All daily tasks (they always exist)
            // 2. One-time tasks that were completed on that day
            // 3. One-time tasks that appear in progress (attempted but maybe not completed)
            const dailyTasks = allTasks.filter(task => (taskTypes[task] || 'daily') === 'daily');
            const oneTimeTasksOnDay = allTasks.filter(task => {
              const taskType = taskTypes[task] || 'daily';
              if (taskType !== 'onetime') return false;
              // Count one-time tasks that were completed or attempted on this day
              return completedTasks.includes(task) || 
                     dateProgress[task] !== undefined || 
                     dateActivity[task] !== undefined;
            });
            tasksOnThisDay = [...dailyTasks, ...oneTimeTasksOnDay];
          }
          
          const tasksCount = tasksOnThisDay.length;
          const completionsCount = completedTasks.length;
          
          totalTasks += tasksCount;
          totalCompletions += completionsCount;
          
          dailyStats.push({
            date,
            tasks: tasksCount,
            completions: completionsCount
          });
          
          completedTasks.forEach(task => {
            taskCounts[task] = (taskCounts[task] || 0) + 1;
          });
        });
        
        const avgTasksPerDay = totalDays > 0 ? (totalTasks / totalDays).toFixed(1) : '0';
        const avgCompletionsPerDay = totalDays > 0 ? (totalCompletions / totalDays).toFixed(1) : '0';
        const avgCompletionRate = totalTasks > 0 ? ((totalCompletions / totalTasks) * 100).toFixed(1) : '0';

        // Show statistics
        const statsDiv = document.createElement('div');
        statsDiv.className = 'statistics';
        
        const totalDaysStat = document.createElement('div');
        totalDaysStat.className = 'stat-item';
        totalDaysStat.innerHTML = `
          <div class="stat-value">${totalDays}</div>
          <div class="stat-label">Days Tracked</div>
        `;
        
        const totalTasksStat = document.createElement('div');
        totalTasksStat.className = 'stat-item';
        totalTasksStat.innerHTML = `
          <div class="stat-value">${totalTasks}</div>
          <div class="stat-label">Total Tasks</div>
        `;
        
        const totalCompletionsStat = document.createElement('div');
        totalCompletionsStat.className = 'stat-item';
        totalCompletionsStat.innerHTML = `
          <div class="stat-value">${totalCompletions}</div>
          <div class="stat-label">Total Completions</div>
        `;
        
        const avgTasksStat = document.createElement('div');
        avgTasksStat.className = 'stat-item';
        avgTasksStat.innerHTML = `
          <div class="stat-value">${avgTasksPerDay}</div>
          <div class="stat-label">Avg Tasks/Day</div>
        `;
        
        const avgCompletionsStat = document.createElement('div');
        avgCompletionsStat.className = 'stat-item';
        avgCompletionsStat.innerHTML = `
          <div class="stat-value">${avgCompletionsPerDay}</div>
          <div class="stat-label">Avg Completions/Day</div>
        `;
        
        const completionRateStat = document.createElement('div');
        completionRateStat.className = 'stat-item';
        completionRateStat.innerHTML = `
          <div class="stat-value">${avgCompletionRate}%</div>
          <div class="stat-label">Completion Rate</div>
        `;
        
        statsDiv.appendChild(totalDaysStat);
        statsDiv.appendChild(totalTasksStat);
        statsDiv.appendChild(totalCompletionsStat);
        statsDiv.appendChild(avgTasksStat);
        statsDiv.appendChild(avgCompletionsStat);
        statsDiv.appendChild(completionRateStat);
        archiveContainer.appendChild(statsDiv);

        // Filter dates (show all dates, not just today)
        let displayDates = allDates;
        if (selectedDate) {
          displayDates = allDates.filter(date => date === selectedDate);
        }

        if (displayDates.length === 0) {
          const noData = document.createElement('div');
          noData.className = 'no-data';
          noData.textContent = selectedDate ? 'No data for selected date' : 'No completion data yet';
          archiveContainer.appendChild(noData);
          return;
        }

        // Show archive by date
        displayDates.forEach(date => {
          const dayDiv = document.createElement('div');
          dayDiv.className = 'archive-day';
          
          const header = document.createElement('div');
          header.className = 'archive-day-header';
          const dateObj = new Date(date + 'T00:00:00');
          const dateStr = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          header.textContent = dateStr;
          dayDiv.appendChild(header);

          const tasksDiv = document.createElement('div');
          tasksDiv.className = 'archive-tasks';
          
          // Show day summary (tasks vs completions)
          const daySummary = document.createElement('div');
          daySummary.className = 'archive-day-summary';
          const dayStat = dailyStats.find(stat => stat.date === date);
          if (dayStat) {
            daySummary.textContent = `${dayStat.completions} of ${dayStat.tasks} tasks completed`;
            daySummary.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 10px; font-style: italic;';
            tasksDiv.appendChild(daySummary);
          }

          // Get completed tasks from archive, or fall back to progress/activity
          let completedTasks = [];
          if (archive[date] && archive[date].length > 0) {
            completedTasks = archive[date];
          } else {
            // Fall back to progress data
            const dateProgress = progress[date] || {};
            const dateActivity = websiteActivity[date] || {};
            completedTasks = allTasks.filter(task => {
              const taskUrl = taskUrls[task] || '';
              if (taskUrl && taskUrl.trim() !== '') {
                return dateActivity[task] === true || dateProgress[task] === true;
              } else {
                return dateProgress[task] === true;
              }
            });
          }
          
          if (completedTasks.length === 0) {
            const noTasks = document.createElement('div');
            noTasks.className = 'no-data';
            noTasks.textContent = 'No tasks completed on this day';
            noTasks.style.padding = '10px';
            tasksDiv.appendChild(noTasks);
          } else {
            completedTasks.forEach(task => {
              const taskDiv = document.createElement('div');
              taskDiv.className = 'archive-task';
              
              const taskName = document.createElement('span');
              taskName.className = 'archive-task-name';
              taskName.textContent = task;
              
              const taskType = taskTypes[task] || 'daily';
              if (taskType === 'onetime') {
                const badge = document.createElement('span');
                badge.style.cssText = 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;';
                badge.textContent = 'One-Time';
                taskName.appendChild(badge);
              }
              
              const completed = document.createElement('span');
              completed.className = 'archive-task-completed';
              completed.textContent = '✓ Completed';
              
              taskDiv.appendChild(taskName);
              taskDiv.appendChild(completed);
              tasksDiv.appendChild(taskDiv);
            });
          }

          dayDiv.appendChild(tasksDiv);
          archiveContainer.appendChild(dayDiv);
        });
      }
    } catch (error) {
      if (archiveContainer) {
        archiveContainer.innerHTML = `<p>Error loading archive: ${error.message}</p>`;
      }
      console.error('Error loading archive:', error);
    }
  }

  if (filterDate) {
    filterDate.addEventListener('change', (e) => {
      const selectedDate = e.target.value;
      loadArchive(selectedDate || null);
    });
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      if (filterDate) {
        filterDate.value = '';
      }
      loadArchive();
    });
  }

  loadArchive();
});

