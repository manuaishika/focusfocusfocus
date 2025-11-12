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
      const result = await chrome.storage.local.get(['progress', 'permanentTasks', 'tasks', 'taskTypes']);
      const progress = result.progress || {};
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const taskTypes = result.taskTypes || {};

      if (archiveContainer) {
        archiveContainer.innerHTML = '';

        // Calculate statistics
        const dates = Object.keys(progress).sort().reverse();
        const totalDays = dates.length;
        let totalCompletions = 0;
        const taskCounts = {};
        
        dates.forEach(date => {
          Object.keys(progress[date]).forEach(task => {
            if (progress[date][task]) {
              totalCompletions++;
              taskCounts[task] = (taskCounts[task] || 0) + 1;
            }
          });
        });

        // Show statistics
        const statsDiv = document.createElement('div');
        statsDiv.className = 'statistics';
        
        const totalDaysStat = document.createElement('div');
        totalDaysStat.className = 'stat-item';
        totalDaysStat.innerHTML = `
          <div class="stat-value">${totalDays}</div>
          <div class="stat-label">Days Tracked</div>
        `;
        
        const totalCompletionsStat = document.createElement('div');
        totalCompletionsStat.className = 'stat-item';
        totalCompletionsStat.innerHTML = `
          <div class="stat-value">${totalCompletions}</div>
          <div class="stat-label">Total Completions</div>
        `;
        
        const avgPerDay = totalDays > 0 ? (totalCompletions / totalDays).toFixed(1) : '0';
        const avgStat = document.createElement('div');
        avgStat.className = 'stat-item';
        avgStat.innerHTML = `
          <div class="stat-value">${avgPerDay}</div>
          <div class="stat-label">Avg per Day</div>
        `;
        
        statsDiv.appendChild(totalDaysStat);
        statsDiv.appendChild(totalCompletionsStat);
        statsDiv.appendChild(avgStat);
        archiveContainer.appendChild(statsDiv);

        // Filter dates
        let displayDates = dates;
        if (selectedDate) {
          displayDates = dates.filter(date => date === selectedDate);
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

          const completedTasks = Object.keys(progress[date]).filter(task => progress[date][task]);
          
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

