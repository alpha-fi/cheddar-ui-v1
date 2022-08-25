import {qs} from '../document';


window.addEventListener("load", function() {
	// Vars
	let variables = {
		pointsA: [],
		pointsB: [],
		$canvas: null,
		canvas: null,
		context: null,
		vars: null,
		points: 8,
		viscosity: 20,
		mouseDist: 70,
		damping: 0.05,
		showIndicators: false,
		mouseX: 0,
		mouseY: 0,
		relMouseX: 0,
		relMouseY: 0,
		mouseLastX: 0,
		mouseLastY: 0,
		mouseDirectionX: 0,
		mouseDirectionY: 0,
		mouseSpeedX: 0,
		mouseSpeedY: 0
	}

	/**
	 * Get mouse direction
	 */
	function mouseDirection(e: MouseEvent) {
		if (variables.mouseX < e.pageX) {
			variables.mouseDirectionX = 1;
		}
		else if (variables.mouseX > e.pageX) {
			variables.mouseDirectionX = -1;
		}
		else {
			variables.mouseDirectionX = 0;
		}

		if (variables.mouseY < e.pageY) {
			variables.mouseDirectionY = 1;
		}
		else if (variables.mouseY > e.pageY) {
			variables.mouseDirectionY = -1;
		}
		else {
			variables.mouseDirectionY = 0;
		}

		variables.mouseX = e.pageX;
		variables.mouseY = e.pageY;

		variables.relMouseX = (variables.mouseX - variables.$canvas.offset().left);
		variables.relMouseY = (variables.mouseY - variables.$canvas.offset().top);
	}
	document.addEventListener('mousemove', mouseDirection);

	/**
	 * Get mouse speed
	 */
	function mouseSpeed() {
		variables.mouseSpeedX = variables.mouseX - variables.mouseLastX;
		variables.mouseSpeedY = variables.mouseY - variables.mouseLastY;

		variables.mouseLastX = variables.mouseX;
		variables.mouseLastY = variables.mouseY;

		setTimeout(mouseSpeed, 50);
	}
	mouseSpeed();

	/**
	 * Init button
	 */

	//DUDA porqué no me deja exportar esta función?
	function initButton(buttonSelector: string) {
		// Get button
		var button = qs(buttonSelector);
		var buttonWidth = button.getBoundingClientRect().width;
		var buttonHeight = button.getBoundingClientRect().height;

		// Create canvas
		//DUDA cómo traduzco esto a vainilla?
		variables.$canvas = $('<canvas></canvas>');
		button.append($canvas);

		variables.canvas = $canvas.get(0);
		//Fin DUDA
		variables.canvas.width = buttonWidth+100;
		variables.canvas.height = buttonHeight+100;
		variables.context = variables.canvas.getContext('2d');

		// Add points

		var x = buttonHeight/2;
		for(var j = 1; j < variables.points; j++) {
			addPoints((x+((buttonWidth-buttonHeight)/variables.points)*j), 0);
		}
		addPoints(buttonWidth-buttonHeight/5, 0);
		addPoints(buttonWidth+buttonHeight/10, buttonHeight/2);
		addPoints(buttonWidth-buttonHeight/5, buttonHeight);
		for(var j = variables.points-1; j > 0; j--) {
			addPoints((x+((buttonWidth-buttonHeight)/variables.points)*j), buttonHeight);
		}
		addPoints(buttonHeight/5, buttonHeight);

		addPoints(-buttonHeight/10, buttonHeight/2);
		addPoints(buttonHeight/5, 0);
		// addPoints(x, 0);
		// addPoints(0, buttonHeight/2);

		// addPoints(0, buttonHeight/2);
		// addPoints(buttonHeight/4, 0);

		// Start render
		renderCanvas();
	}

	/**
	 * Add points
	 */
	function addPoints(x, y) {
		variables.pointsA.push(new Point(x, y, 1));
		variables.pointsB.push(new Point(x, y, 2));
	}

	/**
	 * Point
	 */
	function Point(x, y, level) {
	  this.x = this.ix = 50+x;
	  this.y = this.iy = 50+y;
	  this.vx = 0;
	  this.vy = 0;
	  this.cx1 = 0;
	  this.cy1 = 0;
	  this.cx2 = 0;
	  this.cy2 = 0;
	  this.level = level;
	}

	Point.prototype.move = function() {
		this.vx += (this.ix - this.x) / (variables.viscosity*this.level);
		this.vy += (this.iy - this.y) / (variables.viscosity*this.level);

		var dx = this.ix - variables.relMouseX,
			dy = this.iy - variables.relMouseY;
		var relDist = (1-Math.sqrt((dx * dx) + (dy * dy))/variables.mouseDist);

		// Move x
		if ((variables.mouseDirectionX > 0 && variables.relMouseX > this.x) || (variables.mouseDirectionX < 0 && variables.relMouseX < this.x)) {
			if (relDist > 0 && relDist < 1) {
				this.vx = (variables.mouseSpeedX / 4) * relDist;
			}
		}
		this.vx *= (1 - variables.damping);
		this.x += this.vx;

		// Move y
		if ((variables.mouseDirectionY > 0 && variables.relMouseY > this.y) || (variables.mouseDirectionY < 0 && variables.relMouseY < this.y)) {
			if (relDist > 0 && relDist < 1) {
				this.vy = (variables.mouseSpeedY / 4) * relDist;
			}
		}
		this.vy *= (1 - variables.damping);
		this.y += this.vy;
	};


	/**
	 * Render canvas
	 */
	function renderCanvas() {
		// rAF
		//DUDA de dónde sale este rafID?
		rafID = requestAnimationFrame(renderCanvas);

		// Clear scene
		variables.context.clearRect(0, 0, variables.$canvas.getBoundingClientRect().width, variables.$canvas.getBoundingClientRect().height);
		context.fillStyle = '#fff';
		context.fillRect(0, 0, variables.$canvas.getBoundingClientRect().width, variables.$canvas.getBoundingClientRect().height);

		// Move points

		//DUDA esta función move de dónde está saliendo exactamente?
		for (var i = 0; i <= variables.pointsA.length - 1; i++) {
			variables.pointsA[i].move();
			variables.pointsB[i].move();
		}

		// Create dynamic gradient
		//DUDA de dónde sale la función .offset
		var gradientX = Math.min(Math.max(variables.mouseX - variables.$canvas.offset().left, 0), variables.$canvas.getBoundingClientRect().width);
		var gradientY = Math.min(Math.max(variables.mouseY - variables.$canvas.offset().top, 0), variables.$canvas.getBoundingClientRect().height);
		var distance = Math.sqrt(Math.pow(gradientX - variables.$canvas.getBoundingClientRect().width/2, 2) + Math.pow(gradientY - variables.$canvas.getBoundingClientRect().height/2, 2)) / Math.sqrt(Math.pow(variables.$canvas.getBoundingClientRect().width/2, 2) + Math.pow(variables.$canvas.getBoundingClientRect().height/2, 2));

		//DUDA de dónde sale las funciones .createRadialGradient, .addColorStop, .beginPath, moveTo, bezierCurveTo y fill
		var gradient = variables.context.createRadialGradient(gradientX, gradientY, 300+(300*distance), gradientX, gradientY, 0);
		gradient.addColorStop(0, '#102ce5');
		gradient.addColorStop(1, '#E406D6');

		// Draw shapes
		var groups = [variables.pointsA, variables.pointsB]

		for (var j = 0; j <= 1; j++) {
			var points = groups[j];

			if (j == 0) {
				// Background style
				variables.context.fillStyle = '#1CE2D8';
			} else {
				// Foreground style
				variables.context.fillStyle = gradient;
			}

			variables.context.beginPath();
			variables.context.moveTo(points[0].x, points[0].y);

			for (var i = 0; i < points.length; i++) {
				var p = points[i];
				var nextP = points[i + 1];
				var val = 30*0.552284749831;

				if (nextP != undefined) {
					// if (nextP.ix > p.ix && nextP.iy < p.iy) {
					// 	p.cx1 = p.x;
					// 	p.cy1 = p.y-val;
					// 	p.cx2 = nextP.x-val;
					// 	p.cy2 = nextP.y;
					// } else if (nextP.ix > p.ix && nextP.iy > p.iy) {
					// 	p.cx1 = p.x+val;
					// 	p.cy1 = p.y;
					// 	p.cx2 = nextP.x;
					// 	p.cy2 = nextP.y-val;
					// }  else if (nextP.ix < p.ix && nextP.iy > p.iy) {
					// 	p.cx1 = p.x;
					// 	p.cy1 = p.y+val;
					// 	p.cx2 = nextP.x+val;
					// 	p.cy2 = nextP.y;
					// } else if (nextP.ix < p.ix && nextP.iy < p.iy) {
					// 	p.cx1 = p.x-val;
					// 	p.cy1 = p.y;
					// 	p.cx2 = nextP.x;
					// 	p.cy2 = nextP.y+val;
					// } else {

						p.cx1 = (p.x+nextP.x)/2;
						p.cy1 = (p.y+nextP.y)/2;
						p.cx2 = (p.x+nextP.x)/2;
						p.cy2 = (p.y+nextP.y)/2;

						variables.context.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
					// 	continue;
					// }

					// context.bezierCurveTo(p.cx1, p.cy1, p.cx2, p.cy2, nextP.x, nextP.y);
				} else {
nextP = points[0];
						p.cx1 = (p.x+nextP.x)/2;
						p.cy1 = (p.y+nextP.y)/2;

						variables.context.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
				}
			}

			// context.closePath();
			variables.context.fill();
		}

		if (variables.showIndicators) {
			// Draw points
			variables.context.fillStyle = '#000';
			variables.context.beginPath();
			for (var i = 0; i < variables.pointsA.length; i++) {
				var p = variables.pointsA[i];

				variables.context.rect(p.x - 1, p.y - 1, 2, 2);
			}
			variables.context.fill();

			// Draw controls
			variables.context.fillStyle = '#f00';
			variables.context.beginPath();
			for (var i = 0; i < variables.pointsA.length; i++) {
				var p = variables.pointsA[i];

				variables.context.rect(p.cx1 - 1, p.cy1 - 1, 2, 2);
				variables.context.rect(p.cx2 - 1, p.cy2 - 1, 2, 2);
			}
			variables.context.fill();
		}
	}
	initButton()
});