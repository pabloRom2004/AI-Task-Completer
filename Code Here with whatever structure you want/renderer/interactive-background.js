// src/renderer/interactive-background.js

/**
 * Sets up the interactive background with white and grey dots that cluster
 * and are repelled by mouse movement
 */
export function setupInteractiveBackground() {
    const canvases = document.querySelectorAll('.interactive-background');
    
    if (canvases.length === 0) {
      console.warn('No canvas elements found for interactive background');
      return;
    }
    
    canvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      let width = window.innerWidth;
      let height = window.innerHeight;
      let particles = [];
      let mouseX = width / 2;
      let mouseY = height / 2;
      let animationFrameId = null;
      let clusterCenters = [];
      let clusterCompactness = 6000;
      
      // Handle resize
      window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        generateClusterCenters();
        initParticles();
      });
      
      // Track mouse position for the current canvas
      document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      });
      
      // Initialize canvas
      canvas.width = width;
      canvas.height = height;
      
      // Generate cluster centers for particles
      function generateClusterCenters() {
        clusterCenters = [];
        // Number of clusters scales with canvas size
        const numClusters = Math.max(5, Math.floor((width * height) / 200000));
        for (let i = 0; i < numClusters; i++) {
          clusterCenters.push({
            x: Math.random() * width,
            y: Math.random() * height,
            // Different clusters have different densities
            density: Math.random() * 0.7 + 0.3
          });
        }
      }
      
      // Particle class
      class Particle {
        constructor(forceNew = false) {
          // Assign to a random cluster
          const cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
          
          // Distance from cluster center follows gaussian-like distribution
          const angle = Math.random() * Math.PI * 2;
          // Use clusterCompactness instead of fixed 200 value
          const dist = Math.random() * Math.random() * clusterCompactness * cluster.density;
          
          this.x = cluster.x + Math.cos(angle) * dist;
          this.y = cluster.y + Math.sin(angle) * dist;
          
          // Keep particles within bounds
          this.x = Math.max(0, Math.min(width, this.x));
          this.y = Math.max(0, Math.min(height, this.y));
          
          this.baseX = this.x;
          this.baseY = this.y;
          this.size = Math.random() * 2 + 1; // Simple size variation
          this.density = (Math.random() * 10) + 5; // For repulsion effect
          
          // Monochrome color - white to grey
          const greyValue = Math.floor(Math.random() * 180) + 75; // 75-255 range
          this.color = `rgba(${greyValue}, ${greyValue}, ${greyValue}, 0.8)`;
          
          // Set ghost position to the initial position - it will never change
          this.ghostX = this.baseX;
          this.ghostY = this.baseY;
          
          // These are still needed for other calculations
          this.noiseOffsetX = Math.random() * 1000;
          this.noiseOffsetY = Math.random() * 1000;
          this.noiseChangeSpeed = Math.random() * 0.0005 + 0.0001;
          
          // Initialize last mouse distance
          this.lastMouseDistance = 1000; // Large initial value
        }
        
        update() {
          // Update noise offsets for use in ghost position movement
          this.noiseOffsetX += this.noiseChangeSpeed;
          this.noiseOffsetY += this.noiseChangeSpeed;
          
          // Update ghost position to move in a complex pattern around the base position
          // Use multiple sine/cosine waves with different frequencies for organic "random" movement
          const wave1X = Math.sin(this.noiseOffsetX) * 100.0;
          const wave1Y = Math.cos(this.noiseOffsetY) * 100.0;
          const wave2X = Math.sin(this.noiseOffsetX * 2.5) * 30;
          const wave2Y = Math.cos(this.noiseOffsetY * 2.5) * 30;
          const wave3X = Math.sin(this.noiseOffsetX * 0.6) * 50;
          const wave3Y = Math.cos(this.noiseOffsetY * 0.6) * 50;
          
          // Set ghost position to oscillate around the base position instead of drifting
          this.ghostX = this.baseX + wave1X + wave2X + wave3X;
          this.ghostY = this.baseY + wave1Y + wave2Y + wave3Y;
          
          // Calculate distance from mouse
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          const mouseDistance = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate distance from ghost position
          const dxGhost = this.ghostX - this.x;
          const dyGhost = this.ghostY - this.y;
          const ghostDistance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);
          
          // Mouse repulsion effect - inversed attraction
          const maxRepulsionDistance = 150; // Maximum distance for repulsion
          
          if (mouseDistance < maxRepulsionDistance) {
            // Calculate repulsion force - stronger as mouse gets closer
            const repulsionFactor = 1 - (mouseDistance / maxRepulsionDistance);
            const repulsionForce = repulsionFactor * repulsionFactor * 10; // Exponential effect
            
            // Direction away from mouse
            const repulsionX = -dx / mouseDistance;
            const repulsionY = -dy / mouseDistance;
            
            // Apply repulsion
            this.x += repulsionX * repulsionForce;
            this.y += repulsionY * repulsionForce;
            
            // Store last mouse distance for tracking changes
            this.lastMouseDistance = mouseDistance;
          }
          
          // Always gently move toward ghost position
          this.x += dxGhost * 0.05;
          this.y += dyGhost * 0.05;
          
          // Check if particle is too far outside the canvas
          const margin = 300; // Distance beyond canvas before removal
          if (this.x < -margin || this.x > width + margin || 
              this.y < -margin || this.y > height + margin) {
            // Return false to indicate this particle should be removed
            return false;
          }
          
          return true; // Keep the particle
        }
        
        draw() {
          // Simple solid circle
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
        }
      }
      
      // Connect particles with lines
      function connectParticles() {
        const maxDistance = 100; // Maximum distance for connecting lines
        
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < maxDistance) {
              // Opacity based on distance - stronger lines
              const opacity = 1 - (distance / maxDistance);
              ctx.beginPath();
              ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`; // Stronger lines
              ctx.lineWidth = 1; // Increased line width
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }
      
      // Initialize particles
      function initParticles() {
        particles = [];
        // More particles for a denser effect
        const particleCount = Math.min(Math.floor((width * height) / 2000), 300);
        
        for (let i = 0; i < particleCount; i++) {
          particles.push(new Particle(true));
        }
      }
      
      // Animation loop
      function animate() {
        // Clear with semi-transparent background for trail effect
        ctx.clearRect(0, 0, width, height);
        
        // Update and draw all particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const keepParticle = particles[i].update();
          
          if (keepParticle) {
            particles[i].draw();
          } else {
            // Remove and replace this particle
            particles.splice(i, 1);
            particles.push(new Particle(false));
          }
        }
        
        // Connect nearby particles
        connectParticles();
        
        // Continue animation loop
        animationFrameId = requestAnimationFrame(animate);
      }
      
      // Check if canvas is visible (to avoid unnecessary animation)
      function checkVisibility() {
        const rect = canvas.getBoundingClientRect();
        const isVisible = (
          rect.top + rect.height >= 0 &&
          rect.bottom - rect.height <= window.innerHeight
        );
        
        if (isVisible && !animationFrameId) {
          // Start animation if visible
          animate();
        } else if (!isVisible && animationFrameId) {
          // Stop animation if not visible
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      }
      
      // Check visibility on scroll
      window.addEventListener('scroll', checkVisibility);
      
      // Initialize and start animation
      generateClusterCenters();
      initParticles();
      checkVisibility();
    });
  }
  
  /**
   * Clean up animation frames when necessary
   */
  export function cleanupInteractiveBackground() {
    // This could be called when changing pages or closing the application
    cancelAnimationFrame(window.backgroundAnimationFrame);
  }