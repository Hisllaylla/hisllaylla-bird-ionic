import { Component, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent implements AfterViewInit {

  // Define base dimensions (designed for 300x500 canvas)
  private baseWidth = 300;
  private baseHeight = 500;

  constructor() {}

  ngAfterViewInit(): void {
    /************************
    ***** DECLARATIONS: *****
    ************************/
    let cvs: HTMLCanvasElement = document.getElementById('game') as HTMLCanvasElement;
    let ctx = cvs.getContext('2d') as CanvasRenderingContext2D;
    let description = document.getElementById('description') as HTMLElement;
    let theme1 = new Image();
    let theme2 = new Image();
    let frame: number = 0;
    let degree: number = Math.PI / 180;
    let scale: number = 1;

    // Assets objects declarations (using original numbers; values will be scaled on resize)
    let bg: any, pipes: any, ground: any, map: any, score: any, bird: any, bird1: any, bird2: any;
    let getReady: any, gameOver: any, medal: any;
    
    // Sound effects
    const SFX_SCORE = new Audio();
    const SFX_FLAP = new Audio();
    const SFX_COLLISION = new Audio();
    const SFX_FALL = new Audio();
    const SFX_SWOOSH = new Audio();
    
    // Setup canvas and audio sources with asset paths updated to the ./assets folder
    theme1.src = './assets/img/og-theme.png';
    theme2.src = './assets/img/og-theme-2.png';
    SFX_SCORE.src = './assets/audio/sfx_point.wav';
    SFX_FLAP.src = './assets/audio/sfx_wing.wav';
    SFX_COLLISION.src = './assets/audio/sfx_hit.wav';
    SFX_FALL.src = './assets/audio/sfx_die.wav';
    SFX_SWOOSH.src = './assets/audio/sfx_swooshing.wav';
    
    // Game state
    let gameState = {
      current: 0,
      getReady: 0,
      play: 1,
      gameOver: 2
    };

    // Initialize objects using original base values; these will be updated in resizeCanvas()
    bg = {
      imgX: 0,
      imgY: 0,
      width: 276, // original sprite region
      height: 228, // original sprite region
      x: 0,
      y: 0,
      w: 276,
      h: 228,
      dx: 0.2,
      render: function() {
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x + this.w, this.y, this.w, this.h);
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x + this.w * 2, this.y, this.w, this.h);
      },
      position: function () {
        if (gameState.current === gameState.getReady) {
          this.x = 0;
        }
        if (gameState.current === gameState.play) {
          this.x = (this.x - this.dx * scale) % this.w;
        }
      }
    };

    // Medal object for the game over screen
    // ORIGINAL SPRITE IMAGE COORDINATES (in pixels):
    // Top-left of medal area in game over panel: ~31px from left, ~47px from top
    // Game over panel is 226x158 pixels
    medal = {
      // Medal sprite positions in sprite sheet
      bronze: { imgX: 359, imgY: 157 },
      silver: { imgX: 359, imgY: 113 },
      gold: { imgX: 359, imgY: 69 },
      platinum: { imgX: 359, imgY: 25 },
      width: 44, // Original sprite size
      height: 44, // Original sprite size
      x: 0,
      y: 0,
      w: 44,
      h: 44,
      // Save original medal position relative to game over panel (will be used in resizeCanvas)
      relativeX: 31, // Approximate X position relative to game over panel
      relativeY: 47, // Approximate Y position relative to game over panel
      type: null as string | null,
      
      // Determine medal type based on score
      setMedalType: function(score: number) {
        if (score >= 40) {
          this.type = 'platinum';
        } else if (score >= 30) {
          this.type = 'gold';
        } else if (score >= 20) {
          this.type = 'silver';
        } else if (score >= 10) {
          this.type = 'bronze';
        } else {
          this.type = null;
        }
      },
      
      render: function() {
        if (gameState.current === gameState.gameOver && this.type) {
          const medalType = this.type as 'bronze' | 'silver' | 'gold' | 'platinum';
          
          // DEBUG: Draw a red border around the medal area to visualize placement
          // ctx.strokeStyle = 'red';
          // ctx.lineWidth = 2;
          // ctx.strokeRect(this.x, this.y, this.w, this.h);
          
          ctx.drawImage(
            theme1,
            this[medalType].imgX, 
            this[medalType].imgY,
            this.width,
            this.height,
            this.x,
            this.y,
            this.w,
            this.h
          );
        }
      }
    };

    pipes = {
      top: { imgX: 56, imgY: 323 },
      bot: { imgX: 84, imgY: 323 },
      width: 26,
      height: 160,
      w: 55,
      h: 300,
      gap: 150,
      dx: 2,
      minY: 0,
      maxY: 0,
      pipeGenerator: [] as any[],
      reset: function() {
        this.pipeGenerator = [];
      },
      render: function() {
        for (let i = 0; i < this.pipeGenerator.length; i++) {
          let pipe = this.pipeGenerator[i];
          
          // Draw top pipe at pipe.topY
          ctx.drawImage(
            theme2,
            this.top.imgX,
            this.top.imgY,
            this.width,
            this.height,
            pipe.x,
            pipe.topY,
            this.w,
            this.h
          );
          
          // Draw bottom pipe at pipe.bottomY
          ctx.drawImage(
            theme2,
            this.bot.imgX,
            this.bot.imgY,
            this.width,
            this.height,
            pipe.x,
            pipe.bottomY,
            this.w,
            this.h
          );
        }
      },
      position: function() {
        if (gameState.current !== gameState.play) {
          return;
        }
        // Generate pipes at a fixed interval
        if (frame % 100 === 0) {
          // Limit how high the pipes can go - ensure at least half the pipe is visible on screen
          const minPipeVisibility = -this.h / 2;
          
          // Calculate a random vertical position for the gap
          // Gap can be positioned between 25% and 65% of the screen height
          let minGapPos = cvs.height * 0.25;
          let maxGapPos = cvs.height * 0.65 - this.gap; 
          
          // Random position for the center of the gap
          let gapCenter = Math.floor(Math.random() * (maxGapPos - minGapPos)) + minGapPos;
          
          // Position top pipe so its bottom is at the gap start
          let topPipeY = gapCenter - this.h;
          
          // Ensure the top pipe isn't too high off-screen
          topPipeY = Math.max(topPipeY, minPipeVisibility);
          
          // Position bottom pipe so its top is at the gap end
          let bottomPipeY = gapCenter + this.gap;
          
          // Ensure bottom pipe isn't too low (this should never happen but just in case)
          bottomPipeY = Math.min(bottomPipeY, cvs.height - ground.h - this.h/4);
          
          this.pipeGenerator.push({
            x: cvs.width,
            topY: topPipeY,
            bottomY: bottomPipeY
          });
        }
        
        for (let i = 0; i < this.pipeGenerator.length; i++) {
          let pg = this.pipeGenerator[i];
          let b = {
            left: bird.x - bird.r,
            right: bird.x + bird.r,
            top: bird.y - bird.r,
            bottom: bird.y + bird.r
          };
          
          let p = {
            top: { top: pg.topY, bottom: pg.topY + this.h },
            bot: { top: pg.bottomY, bottom: pg.bottomY + this.h },
            left: pg.x,
            right: pg.x + this.w
          };
          
          pg.x -= this.dx * scale;
          
          if (pg.x < -this.w) {
            this.pipeGenerator.shift();
            score.current++;
            SFX_SCORE.play();
          }
          
          // Collision detection for top pipe
          if (
            b.left < p.right &&
            b.right > p.left &&
            b.top < p.top.bottom &&
            b.bottom > p.top.top
          ) {
            gameState.current = gameState.gameOver;
            SFX_COLLISION.play();
            // Update best score and medal when game ends
            score.setBestScore();
            medal.setMedalType(score.current);
          }
          
          // Collision detection for bottom pipe
          if (
            b.left < p.right &&
            b.right > p.left &&
            b.top < p.bot.bottom &&
            b.bottom > p.bot.top
          ) {
            gameState.current = gameState.gameOver;
            SFX_COLLISION.play();
            // Update best score and medal when game ends
            score.setBestScore();
            medal.setMedalType(score.current);
          }
        }
      }
    };

    ground = {
      imgX: 276,
      imgY: 0,
      width: 224,
      height: 112,
      x: 0,
      y: 0,
      w: 224,
      h: 112,
      dx: 2,
      render: function() {
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
        ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x + this.w, this.y, this.w, this.h);
      },
      position: function() {
        if (gameState.current === gameState.getReady) {
          this.x = 0;
        }
        if (gameState.current === gameState.play) {
          this.x = (this.x - this.dx * scale) % (this.w / 2);
        }
      }
    };

    // Map for number images (remains the same)
    map = [
      { imgX: 496, imgY: 60, width: 12, height: 18 },
      { imgX: 135, imgY: 455, width: 10, height: 18 },
      { imgX: 292, imgY: 160, width: 12, height: 18 },
      { imgX: 306, imgY: 160, width: 12, height: 18 },
      { imgX: 320, imgY: 160, width: 12, height: 18 },
      { imgX: 334, imgY: 160, width: 12, height: 18 },
      { imgX: 292, imgY: 184, width: 12, height: 18 },
      { imgX: 306, imgY: 184, width: 12, height: 18 },
      { imgX: 320, imgY: 184, width: 12, height: 18 },
      { imgX: 334, imgY: 184, width: 12, height: 18 }
    ];

    score = {
      current: 0,
      best: 0,
      x: cvs.width / 2,
      y: 40,
      w: 15,
      h: 25,
      
      // Method to update best score
      setBestScore: function() {
        if (this.current > this.best) {
          this.best = this.current;
          
          // Save to localStorage to persist between sessions
          localStorage.setItem('flappyBirdBestScore', this.best.toString());
        }
      },
      
      reset: function() {
        this.current = 0;
        // We don't reset best score
      },
      
      render: function() {
        // Regular score display during gameplay
        if (gameState.current === gameState.play) {
          this.drawNumber(this.current, this.x, this.y);
        } 
        // On game over screen, display both current and best scores
        else if (gameState.current === gameState.gameOver) {
          // Position for current score (45% down from game over panel top)
          const scoreY = gameOver.y + gameOver.h * 0.38;
          // Position for best score (60% down from game over panel top)
          const bestY = gameOver.y + gameOver.h * 0.58;
          
          // Display current score
          this.drawNumber(this.current, gameOver.x + gameOver.w * 0.6, scoreY);
          
          // Display best score
          this.drawNumber(this.best, gameOver.x + gameOver.w * 0.6, bestY);
        }
      },
      
      drawNumber: function(value: number, x: number, y: number) {
        const string = value.toString();
        const digits = string.length;
        
        // Calculate starting position to center the score
        let startX = x - ((digits * this.w) / 2);
        if (digits % 2 === 0) {
          startX += this.w / 4; // Adjust for even number of digits
        }
        
        // Draw each digit
        for (let i = 0; i < digits; i++) {
          const digit = parseInt(string[i]);
          
          ctx.drawImage(
            theme2,
            map[digit].imgX,
            map[digit].imgY,
            map[digit].width,
            map[digit].height,
            startX + (i * this.w),
            y,
            this.w,
            this.h
          );
        }
      }
    };

    // Load the best score from localStorage if available
    const savedBestScore = localStorage.getItem('flappyBirdBestScore');
    if (savedBestScore) {
      score.best = parseInt(savedBestScore, 10);
    }

    // Yellow bird
    bird = {
      animation: [
        { imgX: 276, imgY: 114 },
        { imgX: 276, imgY: 140 },
        { imgX: 276, imgY: 166 },
        { imgX: 276, imgY: 140 }
      ],
      fr: 0,
      width: 34,
      height: 24,
      x: 50,
      y: 160,
      w: 34,
      h: 24,
      r: 12,
      fly: 5.25,
      gravity: 0.32,
      velocity: 0,
      rotation: 0,
      
      reset: function() {
        this.velocity = 0;
        this.y = 160 * scale;
        this.rotation = 0;
        this.fr = 0;
      },
      
      render: function() {
        let birdFrame = this.animation[this.fr];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.drawImage(theme1, birdFrame.imgX, birdFrame.imgY, this.width, this.height, -this.w/2, -this.h/2, this.w, this.h);
        ctx.restore();
      },
      flap: function() {
        this.velocity = -this.fly;
      },
      position: function() {
        if (gameState.current === gameState.getReady) {
          this.y = 160 * scale;
          this.rotation = 0;
          if (frame % 20 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
        } else {
          if (frame % 4 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
          this.velocity += this.gravity;
          this.y += this.velocity * scale;
          if (this.velocity <= this.fly) {
            this.rotation = -15 * degree;
          } else if (this.velocity >= this.fly + 2) {
            this.rotation = 70 * degree;
            this.fr = 1;
          } else {
            this.rotation = 0;
          }
          if (this.y + this.h/2 >= cvs.height - ground.h) {
            this.y = cvs.height - ground.h - this.h/2;
            this.fr = 2;
            this.rotation = 70 * degree;
            if (gameState.current === gameState.play) {
              gameState.current = gameState.gameOver;
              SFX_FALL.play();
              // Update best score when game ends by hitting ground
              score.setBestScore();
              medal.setMedalType(score.current);
            }
          }
          if (this.y - this.h/2 <= 0) {
            this.y = this.r * scale;
          }
        }
      }
    };

    // Red bird (similar scaling)
    bird1 = {
      animation: [
        { imgX: 115, imgY: 381 },
        { imgX: 115, imgY: 407 },
        { imgX: 115, imgY: 433 },
        { imgX: 115, imgY: 407 }
      ],
      fr: 0,
      width: 18,
      height: 12,
      x: 50,
      y: 160,
      w: 34,
      h: 24,
      r: 12,
      fly: 5.25,
      gravity: 0.32,
      velocity: 0,
      render: function() {
        let birdFrame = this.animation[this.fr];
        ctx.drawImage(theme2, birdFrame.imgX, birdFrame.imgY, this.width, this.height, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      },
      flap: function() {
        this.velocity = -this.fly;
      },
      position: function() {
        if (gameState.current === gameState.getReady) {
          this.y = 160 * scale;
          if (frame % 20 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
        } else {
          if (frame % 4 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
          this.velocity += this.gravity;
          this.y += this.velocity * scale;
          if (this.y + this.h/2 >= cvs.height - ground.h) {
            this.y = cvs.height - ground.h - this.h/2;
            this.fr = 2;
            if (gameState.current === gameState.play) {
              gameState.current = gameState.gameOver;
              SFX_FALL.play();
              // Update best score
              score.setBestScore();
              medal.setMedalType(score.current);
            }
          }
          if (this.y - this.h/2 <= 0) {
            this.y = this.r * scale;
          }
        }
      }
    };

    // Blue bird (similar scale)
    bird2 = {
      animation: [
        { imgX: 87, imgY: 491 },
        { imgX: 115, imgY: 329 },
        { imgX: 115, imgY: 355 },
        { imgX: 115, imgY: 329 }
      ],
      fr: 0,
      width: 18,
      height: 12,
      x: 50,
      y: 160,
      w: 34,
      h: 24,
      r: 12,
      fly: 5.25,
      gravity: 0.32,
      velocity: 0,
      render: function() {
        let birdFrame = this.animation[this.fr];
        ctx.drawImage(theme2, birdFrame.imgX, birdFrame.imgY, this.width, this.height, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      },
      flap: function() {
        this.velocity = -this.fly;
      },
      position: function() {
        if (gameState.current === gameState.getReady) {
          this.y = 160 * scale;
          if (frame % 20 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
        } else {
          if (frame % 4 === 0) {
            this.fr = (this.fr + 1) % this.animation.length;
          }
          this.velocity += this.gravity;
          this.y += this.velocity * scale;
          if (this.y + this.h/2 >= cvs.height - ground.h) {
            this.y = cvs.height - ground.h - this.h/2;
            this.fr = 2;
            if (gameState.current === gameState.play) {
              gameState.current = gameState.gameOver;
              SFX_FALL.play();
              // Update best score
              score.setBestScore();
              medal.setMedalType(score.current);
            }
          }
          if (this.y - this.h/2 <= 0) {
            this.y = this.r * scale;
          }
        }
      }
    };

    // Get ready screen
    getReady = {
      imgX: 0,
      imgY: 228,
      width: 174,
      height: 160,
      x: 0,
      y: 0,
      w: 174,
      h: 160,
      render: function() {
        if (gameState.current === gameState.getReady) {
          ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
        }
      }
    };

    // Game over screen
    gameOver = {
      imgX: 174,
      imgY: 228,
      width: 226,
      height: 158,
      x: 0,
      y: 0,
      w: 226,
      h: 158,
      render: function() {
        if (gameState.current === gameState.gameOver) {
          ctx.drawImage(theme1, this.imgX, this.imgY, this.width, this.height, this.x, this.y, this.w, this.h);
          description.style.visibility = "visible";
          
          // DEBUG: Draw red outline around game over panel to debug positioning
          // ctx.strokeStyle = 'red';
          // ctx.lineWidth = 2;
          // ctx.strokeRect(this.x, this.y, this.w, this.h);
        }
      }
    };

    // Resize canvas and re-scale assets based on window dimensions
    const resizeCanvas = () => {
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
      // Choose a uniform scale based on the base dimensions
      scale = Math.min(cvs.width/this.baseWidth, cvs.height/this.baseHeight);

      // Update positions and dimensions based on the scale
      // Update background
      bg.w = 276 * scale;
      bg.h = 228 * scale;
      bg.y = cvs.height - bg.h;

      // Update ground
      ground.w = 224 * scale;
      ground.h = 112 * scale;
      ground.y = cvs.height - ground.h;

      // Update getReady screen
      getReady.w = 174 * scale;
      getReady.h = 160 * scale;
      getReady.x = (cvs.width - getReady.w) / 2;
      getReady.y = (cvs.height - getReady.h) / 2;

      // Update gameOver screen
      gameOver.w = 226 * scale;
      gameOver.h = 158 * scale;
      gameOver.x = (cvs.width - gameOver.w) / 2;
      gameOver.y = (cvs.height - gameOver.h) / 2;

      // NEW APPROACH: Calculate medal position based on its relative position in game over panel
      // The medal position in the original sprite is approximately at (31, 47) pixels from the top-left
      // of the game over panel. We scale that position according to our current scale.
      medal.w = 40 * scale; 
      medal.h = 40 * scale;
      
      // Calculate medal position based on game over panel position and original relative position
      const medalRelativeXScale = medal.relativeX / gameOver.width; // Convert to ratio of panel width
      const medalRelativeYScale = medal.relativeY / gameOver.height; // Convert to ratio of panel height
      
      medal.x = gameOver.x + (gameOver.w * medalRelativeXScale);
      medal.y = gameOver.y + (gameOver.h * medalRelativeYScale);

      // Update pipes scaling
      pipes.w = 55 * scale;
      pipes.h = 300 * scale;
      pipes.gap = 150 * scale;

      // Update score positioning
      score.x = cvs.width / 2;
      score.y = 40 * scale;
      score.w = 15 * scale;
      score.h = 25 * scale;

      // Update birds and their initial coordinates and sizes
      bird.w = 34 * scale;
      bird.h = 24 * scale;
      bird.x = 50 * scale;
      bird.y = 160 * scale;
      bird.r = 12 * scale;

      bird1.w = 34 * scale;
      bird1.h = 24 * scale;
      bird1.x = 50 * scale;
      bird1.y = 160 * scale;
      bird1.r = 12 * scale;

      bird2.w = 34 * scale;
      bird2.h = 24 * scale;
      bird2.x = 50 * scale;
      bird2.y = 160 * scale;
      bird2.r = 12 * scale;
    };

    // Add resize event listener
    window.addEventListener('resize', resizeCanvas);
    // Initialize canvas size and assets positions
    resizeCanvas();

    /************************
    ***** FUNCTIONS: ********
    ************************/
    const draw = () => {
      ctx.fillStyle = '#00bbc4';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      bg.render();
      pipes.render();
      ground.render();
      bird.render();
      getReady.render();
      gameOver.render(); // Draw gameOver first
      if (gameState.current === gameState.gameOver) {
        medal.render(); // Then draw medal (so it appears on top of gameOver)
      }
      score.render(); // Finally draw score (on top of everything)
    };

    const update = () => {
      bird.position();
      bg.position();
      pipes.position();
      ground.position();
    };

    const loop = () => {
      draw();
      update();
      frame++;
    };

    // Added function to reset the game
    const resetGame = () => {
      pipes.reset();
      score.reset();
      bird.reset();
      medal.type = null; // Reset medal
      gameState.current = gameState.getReady;
      SFX_SWOOSH.play();
      description.style.visibility = "hidden";
    };

    loop();
    setInterval(loop, 17);

    /*************************
    ***** EVENT HANDLERS *****
    *************************/
    cvs.addEventListener('click', () => {
      if (gameState.current === gameState.getReady) {
        gameState.current = gameState.play;
      } else if (gameState.current === gameState.play) {
        bird.flap();
        SFX_FLAP.play();
        description.style.visibility = "hidden";
      } else if (gameState.current === gameState.gameOver) {
        resetGame();
      }
    });
  }
}