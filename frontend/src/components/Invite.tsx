import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function Invite() {
    const {uuid} = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`/api/invite/${uuid}`).then(res => res.json()).then((data : {lobby_id: number}) => {
            navigate(`/lobby/${data.lobby_id}`);
        }).catch(err=>console.log(err));

    }, [uuid, navigate]);

    return <div>Wrong url</div>;
}