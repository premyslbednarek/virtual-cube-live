import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function Invite() {
    const {uuid} = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`/api/parse_invite/${uuid}`)
            .then(res => res.json())
            .then(({type, id} : {type: "together" | "lobby", id: number}) => {
                    if (type == "together") {
                        navigate("/together", {state: {id: id}})
                    } else {
                        navigate(`/lobby/${id}`);
                    }
                })
            .catch(err=>console.log(err));

    }, [uuid, navigate]);

    return <div>Wrong url</div>;
}