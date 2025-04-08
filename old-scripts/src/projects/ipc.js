/**
 * Project IPC module
 * Handles communication between renderer and main processes for project operations
 */

export function setupProjectIPC(electronAPI) {
  /**
   * Get all projects
   * @returns {Promise<Array>} Array of project objects
   */
  async function getProjects() {
    return await electronAPI.projects.getProjects();
  }

  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async function createProject(projectData) {
    return await electronAPI.projects.createProject(projectData);
  }

  /**
   * Delete a project
   * @param {string} projectId - ID of the project to delete
   * @returns {Promise<Object>} Result of the deletion
   */
  async function deleteProject(projectId) {
    return await electronAPI.projects.deleteProject(projectId);
  }

  /**
   * Get a specific project
   * @param {string} projectId - ID of the project to get
   * @returns {Promise<Object>} Project data
   */
  async function getProject(projectId) {
    return await electronAPI.projects.getProject(projectId);
  }

  /**
   * Update project progress state
   * @param {string} projectId - ID of the project
   * @param {string} progress - New progress state
   * @returns {Promise<Object>} Updated project
   */
  async function updateProjectProgress(projectId, progress) {
    return await electronAPI.projects.updateProjectProgress(projectId, progress);
  }

  return {
    getProjects,
    createProject,
    deleteProject,
    getProject,
    updateProjectProgress
  };
}