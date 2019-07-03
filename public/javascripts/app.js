$(function() {
	let TemplatingEngine = {
		todosHeaderTemplate: null,
		navHeaderTemplate: null,
		todosTemplate: null,
		modalTemplate: null,

		registerTemplates: function() {
			this.todosHeaderTemplate = Handlebars.compile($('#todosHeaderTemplate').html());
			this.todosTemplate = Handlebars.compile($('#todosTemplate').html());
			this.modalTemplate = Handlebars.compile($('#modal').html());
			this.navHeaderTemplate = Handlebars.compile($('#navHeaderTemplate').html());

			Handlebars.registerPartial('todosTemplate', $('#todosTemplate').html());
		},
	};


	// ------------------------------------------------------------------------------------


	let TodosListEngine = {
		rawData: null,
		renderedData: null,
		date: null,
		status: null,

		processDates: function(info) {
			return info.map(function(todo) {
				todo.monthYear = this.concatenateDate(todo.month, todo.year);
				return todo;
			}, this)
		},

		concatenateDate: function(month, year) {
			if (month && year) {
				return month + '/' + year.substr(2, 3);
			}

			return 'No Due Date';
		},

		rearrangeTaskByCompletion: function(info) {
			return info.sort(function(a, b) {
				return a.completed - b.completed;
			});
		},

		removeTodosList: function() {
			$('.todos').remove();
		},

		prepareDataForNavBar: function(info) {
			let hash = {};
			let length;
			let k;

			info.forEach(function(todo) {
				let key = todo.monthYear;
				hash[key] = {};
			})

			for (k in hash) {
			 	let todos = info.filter(function(todo) {
					return todo.monthYear === k;
				});

				hash[k].total = todos.length;
				hash[k].todos = todos;

				let completedTodos = todos.filter(function(todo) {
					return todo.completed;
				});

				hash[k].completed = completedTodos.length;
				hash[k].completedTodos = completedTodos;
			};

			return hash;
		},

		getAllCompletedTodos: function(info) {
			return info.filter(function(todo) {
				return todo.completed;
			});
		},

		groupRawData: function(data) {
			data = this.processDates(data);
			this.renderedData = this.prepareDataForNavBar(data);
		},

		bindEvents() {
			$('.addAnchor').on('click', 'button[name="add"]', NewTodosEngine.addNewTodo.bind(NewTodosEngine));
			$('.deleteAnchor').on('click', '.trash', DeleteTodosEngine.deleteTodo.bind(DeleteTodosEngine));
			$('.container').on('click', 'p', EditTodosEngine.editTodo.bind(EditTodosEngine));
			$('header').on('click', 'li', this.getGroupTodos.bind(this));
			$('.editAnchor').on('click', '.content', EditTodosEngine.toggleCompletion.bind(EditTodosEngine));
		},

		findDate: function(node) {
			return node.find('a').text() || node.find('h2').text() || $(e.target).text()
		},

		getGroupTodos: function(e) {
			this.date =  this.findDate($(e.target));
			this.status = $(e.target).closest('li').attr('data-status');
			let data = this.getData(this.status)

			$('nav').find('.active').removeClass('active');
			$(e.target).closest('li').toggleClass('active');
			this.renderTodosList(data, this.date);
		},

		getData: function(status) {
			switch (status) {
			case 'allTodos':
				data = this.rawData;
				break;
			case 'todos':
				data = this.renderedData[this.date].todos;
				break;
			case 'allCompletedTodos':
				data = this.getAllCompletedTodos(this.rawData);
				break;
			case 'completedTodos':
				data = this.renderedData[this.date].completedTodos;
				break;
			}

			return data;
		},

		renderNavBar: function(data) {
			let totalquantity = this.rawData.length;
			let completedQuantity = this.getAllCompletedTodos(this.rawData).length;

			$('header').empty();
			$('header').append(TemplatingEngine.navHeaderTemplate(
				{items: data, totalQuantity: totalquantity, completedQuantity: completedQuantity}
			));

			$('li[data-status=' + this.status + ']:contains(' + this.date + ')').addClass('active');
		},

		renderTodosList: function(data, group) {
			let quantity = data.length;

			data = this.rearrangeTaskByCompletion(data);

			$('.container').empty();
			$('.container').append(TemplatingEngine.todosHeaderTemplate(
				{todos: data, quantity: quantity, group: group}
			));
		},

		init: function() {
			let self = this;

			this.bindEvents();
			this.date = 'All Todos';
			this.status = 'allTodos';
			ApiEngine.apiCall(null, 'get'). then(function(result) {
				self.rawData = result;

				self.groupRawData(self.rawData); //processess raw data into renderedData
				self.renderTodosList(result, 'All Todos');
				self.renderNavBar(self.renderedData);
			});
		}
	};


	// ------------------------------------------------------------------------------------


	let NewTodosEngine = {
		addNewTodo: function(e) {
			e.preventDefault();
			e.stopPropagation();

			this.renderModal();
		},

		renderModal: function() {
			$('.container').append(TemplatingEngine.modalTemplate());
			$('form, .overlay').fadeIn(400);
			FormBehaviorEngine.bindNewTodoEvent();
		},

		processAddingTodo: function(todo) {
			this.addTodoToRawData(todo);
			TodosListEngine.groupRawData(TodosListEngine.rawData);

			if ($('.todos').find('h2').text() !== 'All Todos') {
				TodosListEngine.date = 'All Todos';
				TodosListEngine.status = 'allTodos';
				TodosListEngine.renderTodosList(TodosListEngine.rawData, 'All Todos');
				TodosListEngine.renderNavBar(TodosListEngine.renderedData);
				return;
			}

			ClientStateEngine.processAddingTodo(todo);
		},

		addTodoToRawData: function(data) {
			TodosListEngine.rawData.push(data);
		},
	};


	// ------------------------------------------------------------------------------------


	let DeleteTodosEngine = {
		deleteTodo: function(e) {
			e.preventDefault();
			e.stopPropagation();

			let todo = e.target;

			this.processDeletion(todo, 'delete');
		},

		processDeletion: function(element, method) {
			let self = this;

			ApiEngine.apiCall(element, method).then(function(result) {
				let id = $(element).parents('tr').attr('data-id');

				self.removeTodoFromRawData(id);
				TodosListEngine.groupRawData(TodosListEngine.rawData);
				ClientStateEngine.processDeletion(element);
			});
		},

		removeTodoFromRawData: function(identification) {
			let data = TodosListEngine.rawData;

			TodosListEngine.rawData = data.filter(function(todo) {
				return String(todo.id) !== String(identification);
			});
		},
	};



// ----------------------------------------------------------------------------------


	let EditTodosEngine = {
		editTodo: function(e) {
			e.preventDefault();
			e.stopPropagation();
			console.log(e);


			let todo = e.target;

			this.bringUpEditScreen(todo, 'get');
			return false;

		},

		bringUpEditScreen: function(element, method) {
			let self = this;

			ApiEngine.apiCall(element, method).then(function(result) {
				self.renderModal(result);
			});
		},

		renderModal: function(data) {
			let result = this.processData(data);

			console.log(data);

			$('.container').append(TemplatingEngine.modalTemplate(result));
			$('form, .overlay').fadeIn(400);
			FormBehaviorEngine.bindEditingTodoEvent();
		},

		processData: function(object) {
			let day = object.day;
			let month = object.month;

			object.day = this.convertDay(day);
			object.month = this.convertMonth(month);
			return object;
		},

		convertDay: function(number) {
			let regex = new RegExp('^0[1-9]');

			if (regex.test(number)) {
				return [
					{value: number},
					{text: number.replace('0', '')},
				];
			}

			return [{value: number}, {text: number}];
		},

		convertMonth: (function() {
			const monthConverter = {
				'01': 'January',
				'02': 'February',
				'03': 'March',
				'04': 'April',
				'05': 'May',
				'06': 'June',
				'07': 'July',
				'08': 'August',
				'09': 'September',
				'10': 'October',
				'11': 'November',
				'12': 'December',
			};

			return function(number) {
				let text = monthConverter[number];

				return [{value: number}, {text: text}];
			}
		})(),

		processEditingTodo: function(todo) {
			let id = todo.id;

			DeleteTodosEngine.removeTodoFromRawData(id);
			NewTodosEngine.addTodoToRawData(todo);
			TodosListEngine.groupRawData(TodosListEngine.rawData);
			ClientStateEngine.processEditingTodo(todo);
		},

		processTogglingTodo: function(todo) {
			let id = todo.id;

			DeleteTodosEngine.removeTodoFromRawData(id);
			NewTodosEngine.addTodoToRawData(todo);
			TodosListEngine.groupRawData(TodosListEngine.rawData);
			ClientStateEngine.processTogglingTodo(todo);
		},

		processCompletion: function(e) {
			e.preventDefault();
			let form = $(e.target).parents('form').get(0);

			let completed = this.checkTodoStatus(form);

			if (!completed) {
				this.toggleComplete(form, 'post', '/toggle_completed');
				return FormBehaviorEngine.removeForm();
			}

			FormBehaviorEngine.removeForm();
		},

		toggleCompletion: function(e) {
			this.toggleComplete(e.target, 'post', '/toggle_completed')
		},

		toggleComplete: function(task, method, togglePath) {
			let self = this;

			ApiEngine.apiCall(task, method, togglePath).then(function(result) {
				self.crossOutItem(task);
				self.processTogglingTodo(result);
			});
		},

		checkTodoStatus: function(element) {
			return $(element).attr('data-status') === 'true';
		},

		crossOutItem: function(item) {
			let id = $(item).attr('data-id') || $(item).parents('tr').attr('data-id');
			let row = $('tr[data-id=' + id + ']');

			row.toggleClass('strike');
		}

	};


	// -------------------------------------------------------------------------------


	let FormBehaviorEngine = {
		bindEditingTodoEvent: function() {
			$('form').on('submit', this.submitEdits.bind(this));
			$('input[name="mark_as_complete"]').on('click', EditTodosEngine.processCompletion.bind(EditTodosEngine));
			this.bindEvents();
		},

		bindNewTodoEvent: function() {
			$('form').on('submit', this.submitData.bind(this));
			$('input[name="mark_as_complete"]').on('click', function(e){
				alert('Cannot mark as complete as item is not created yet');
			});
			this.bindEvents();
		},

		bindEvents: function() {
			$('body').on('click', '.overlay', this.removeForm.bind(this));
			$('form').on('blur', 'input[name="title"]', this.verifyLength)
		},

		unbindEvents: function() {
			$('form').off();
			$('body').off();
			$('input[name="mark_as_complete"]').off();
		},

		verifyLength: function(e) {
			if ($(e.target).val().length <= 3) {
				alert('The length of the title must be at least 3 characters long');
			}
		},

		submitEdits: function(e) {
			e.preventDefault();
			let currentForm = e.target;
			let self = this;

			ApiEngine.apiCall(currentForm, 'put').then(function(result) {
				self.unbindEvents();
				self.removeForm();
				EditTodosEngine.processEditingTodo(result);
			}, function(err) {
				alert('The length of the title must be at least 3 characters long');
			});
		},

		submitData: function(e) {
			e.preventDefault();
			let currentForm = e.target;
			let self = this;

			ApiEngine.apiCall(currentForm, 'post').then(function(result) {
				self.unbindEvents();
				self.removeForm();
				NewTodosEngine.processAddingTodo(result)
			}, function(err) {
				alert('The length of the title must be at least 3 characters long');
			});
		},

		removeForm: function(e) {
			$('form, .overlay').fadeOut(400, function() {
				$(this).remove();
			});
		},
	};


// ----------------------------------------------------------------------------


	let ApiEngine = {
		processUrl: function(element, togglePath) {
			let path = '/api/todos';
			let identification = ($(element).parents('tr').attr('data-id') ||
				$(element).attr('data-id'))

			if (identification) {
				path = path + '/' + identification;
			}

			if (togglePath) {
				path = path + togglePath;
			}

			return path;
		},

		processData: function(element) {
			if ($(element).is('form')) {
				return $(element).serializeArray();
			}

			return null;
		},

		apiCall: function(element, method, togglePath) {
			let url = this.processUrl(element, togglePath);
			let data = this.processData(element);

			return new Promise(function(resolve, reject) {
				$.ajax({
					url: url,
					type: method,
					dataType: 'json',
					data: data,
				})

				.done(function(response) {
					resolve(response);
				})

				.fail(function(response) {
					reject(response);
				});
			});
		}
	};


// ------------------------------------------------------------------------------


	let ClientStateEngine = {
		decrementNumber: function(element) {
			let circle = $(element).parents('.todos').find('.current');
			let newAmount = Number(circle.text()) - 1;

			circle.text(newAmount);
		},

		processDeletion: function(element) {
			let row = $(element).parents('tr');

			this.decrementNumber(element);
			if (row.length === 0) {
				row = element;
			}

			row.remove();
			TodosListEngine.renderNavBar(TodosListEngine.renderedData);
		},

		processAddingTodo: function(todo) {
			let circle = $('.todos').find('.current');
			let newAmount = Number(circle.text()) + 1;

			circle.text(newAmount);
			todo = TodosListEngine.processDates([todo]);

			$('table').find('tr').first().after(TemplatingEngine.todosTemplate({todos: todo}));
			TodosListEngine.renderNavBar(TodosListEngine.renderedData);
		},

		processEditingTodo: function(todo) {
			let date = $('.todos').find('h2').text();
			let element = $('tr[data-id=' + todo.id + ']');

			if (todo.monthYear === date || date === 'All Todos' || date === 'Completed') {
				let newContent = todo.title + ' - ' + todo.monthYear;
				element.find('p').text(newContent);
				return;
			}

			this.processDeletion(element);
		},

		processTogglingTodo: function(todo) {
			let data = TodosListEngine.getData(TodosListEngine.status);

			TodosListEngine.renderTodosList(data, TodosListEngine.date);
			TodosListEngine.renderNavBar(TodosListEngine.renderedData);
		},
	};

	TemplatingEngine.registerTemplates();
	TodosListEngine.init();

});







