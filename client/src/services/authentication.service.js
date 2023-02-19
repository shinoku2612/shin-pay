import { publicRequest } from '../config/axios.config';
import { login } from '../redux/slice/authentication.slice';
import { setToast } from '../redux/slice/global.slice';

export async function registerService({ code, email, password }, dispatch) {
    try {
        await publicRequest.post('/auth/register', {
            code,
            email,
            password,
        });
        dispatch(
            setToast({
                show: true,
                type: 'success',
                message: 'Successfully register. Welcome to our platform!',
            }),
        );
        return true;
    } catch (error) {
        dispatch(
            setToast({
                show: true,
                type: 'danger',
                message: error.response.data.message,
            }),
        );
        return false;
    }
}
export async function loginService({ code, email, password }, dispatch) {
    try {
        const res = await publicRequest.post('/auth/login', {
            code,
            email,
            password,
        });
        dispatch(login(res.data.data.userId));
        return true;
    } catch (error) {
        dispatch(
            setToast({
                show: true,
                type: 'danger',
                message: error.response.data.message,
            }),
        );
        return false;
    }
}