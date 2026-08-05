import { apiLogin, apiRequest } from './e2e/helpers/api-helpers.js';
import { TEST_USERS, TEST_WORKSPACE, TEST_PROJECT } from './e2e/helpers/constants.js';

async function testApi() {
  try {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    console.log('Login successful');

    const res1 = await apiRequest(`/workspaces/${TEST_WORKSPACE.slug}/projects/${TEST_PROJECT.key}/tasks`, accessToken);
    console.log('Tasks Array:', JSON.stringify(res1.data, null, 2));

    const res2 = await apiRequest(`/workspaces/${TEST_WORKSPACE.slug}/projects/${TEST_PROJECT.key}/sprints`, accessToken);
    console.log('Sprints Array:', JSON.stringify(res2.data, null, 2));
    
  } catch (err) {
    console.error(err);
  }
}

testApi();
